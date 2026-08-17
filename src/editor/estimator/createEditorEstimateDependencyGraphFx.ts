import { Effect } from "effect";

import type {
	EditorEstimateDependencyGraph,
	EditorEstimateLimitation,
	EditorEstimateRequirement,
	EditorEstimateRoute,
} from "~/editor/estimator/EditorEstimateDependencyGraph";
import { readEditorEstimateAvailabilityRequirementsFx } from "~/editor/estimator/readEditorEstimateAvailabilityRequirementsFx";
import { readEditorEstimateOutputOccurrencesFx } from "~/editor/estimator/readEditorEstimateOutputOccurrencesFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

interface LineDescriptor {
	readonly chargeCostsByItemId: ReadonlyMap<IdSchema.Type, ReadonlyArray<number>>;
	readonly line: LineSchema.Type;
	readonly owner: ItemSchema.Type;
	readonly requirements: EditorEstimateRoute["requirements"];
}

const readItemLines = (item: ItemSchema.Type): ReadonlyArray<LineSchema.Type> => {
	switch (item.type) {
		case "blueprint":
		case "craft":
		case "stash":
			return [
				item.line,
			];
		case "deposit":
		case "producer":
			return item.lines ?? [];
		case "inventory":
		case "simple":
		case "temporary":
			return [];
	}
};

const readOutputDrops = (output: OutputSchema.Type | undefined) =>
	output?.set.flatMap((set) =>
		set.roll.flatMap((roll) =>
			roll.type === "weight" ? roll.drop.flatMap((candidate) => candidate.drop) : roll.drop,
		),
	) ?? [];

const readItemOutputs = (item: ItemSchema.Type): ReadonlyArray<OutputSchema.Type | undefined> => [
	...readItemLines(item).map(({ output }) => output),
	item.charges?.output,
	...(item.merge ?? []).map(({ output }) => output),
	item.type === "temporary" ? item.output : undefined,
];

const readLimitations = (config: GameConfigSchema.Type) => {
	const limitations = new Set<EditorEstimateLimitation>();
	for (const item of Object.values(config.items)) {
		for (const line of readItemLines(item)) {
			if (
				line.rules.some(
					({ type }) => type === "runtime:adjust" || type === "runtime:multiplier",
				)
			)
				limitations.add("conditional-runtime-adjustments-ignored");
			if (
				line.input.some(({ type }) => type === "deposit") ||
				line.rules.some(({ when }) => when.length > 0)
			)
				limitations.add("spatial-requirements-approximated");
		}
		if (
			readItemLines(item).some((line) =>
				line.input.some(({ charges }) => charges !== undefined),
			)
		)
			limitations.add("charge-renewal-approximated");
		if (
			readItemOutputs(item).some((output) =>
				readOutputDrops(output).some(({ rules }) => rules.length > 0),
			)
		)
			limitations.add("spatial-requirements-approximated");
	}
	return [
		...limitations,
	].sort((left, right) => left.localeCompare(right));
};

const combineRequirements = (
	...groups: ReadonlyArray<EditorEstimateRoute["requirements"]>
): EditorEstimateRoute["requirements"] => ({
	allOf: groups.flatMap(({ allOf }) => allOf),
	anyOf: groups.flatMap(({ anyOf }) => anyOf),
});

const makeOrdinaryLineRequirements = (
	requirements: EditorEstimateRoute["requirements"],
): EditorEstimateRoute["requirements"] => ({
	...requirements,
	allOf: requirements.allOf.map((requirement) =>
		requirement.source === "charged-item"
			? {
					...requirement,
					quantity: 1,
					usage: "ongoing",
				}
			: requirement,
	),
});

const makeChargeDepletionRequirements = (
	requirements: EditorEstimateRoute["requirements"],
	chargedItemId: string,
	runMultiplier: number,
): EditorEstimateRoute["requirements"] => ({
	...requirements,
	allOf: [
		...requirements.allOf.filter(
			(requirement) =>
				requirement.factId !== chargedItemId ||
				!(
					[
						"charged-item",
						"deposit-input",
						"owner",
					] as const
				).includes(requirement.source as "charged-item" | "deposit-input" | "owner"),
		),
		makeRequirement(chargedItemId, 1 / runMultiplier, "charged-item", "consume"),
	],
});

const makeRequirement = (
	factId: string,
	quantity: number,
	source: EditorEstimateRequirement["source"],
	usage: EditorEstimateRequirement["usage"],
): EditorEstimateRequirement => ({
	factId,
	quantity,
	source,
	usage,
});

const readStartQuantityByItemId = (config: GameConfigSchema.Type) => {
	const quantities = new Map<string, number>();
	const add = (itemId: string, quantity = 1) =>
		quantities.set(itemId, (quantities.get(itemId) ?? 0) + quantity);
	for (const item of config.start.board) add(item.itemId, item.quantity);
	for (const item of config.start.inventory) add(item.itemId, item.quantity);
	for (const item of config.start.toolbar) add(item.itemId, item.quantity);
	return quantities;
};

const readLineDescriptorFx = Effect.fn("createEditorEstimateDependencyGraphFx.line")(function* (
	config: GameConfigSchema.Type,
	owner: ItemSchema.Type,
	line: LineSchema.Type,
) {
	if (!line.enable && !line.rules.some(({ type }) => type === "enable")) return undefined;
	const requirements: EditorEstimateRequirement[] = [
		makeRequirement(owner.id, 1, "owner", "one-time"),
	];
	const chargeCostsByItemId = new Map<string, number[]>();
	const addCharge = (itemId: string, cost: number) => {
		const costs = chargeCostsByItemId.get(itemId) ?? [];
		costs.push(cost);
		chargeCostsByItemId.set(itemId, costs);
		const capacity = config.items[itemId]?.charges?.amount ?? cost;
		requirements.push(makeRequirement(itemId, cost / capacity, "charged-item", "consume"));
	};

	for (const input of line.input) {
		if (input.type === "deposit" && input.charges === undefined) return undefined;
		if (input.type === "materials")
			requirements.push(
				makeRequirement(
					input.selector.itemId,
					input.quantity.min,
					"material-input",
					input.mode === "consume" ? "consume" : "ongoing",
				),
			);
		if (input.type === "deposit")
			requirements.push(
				makeRequirement(input.query.selector.itemId, 1, "deposit-input", "one-time"),
			);
		if (input.charges === undefined) continue;
		if (input.charges.from === "self") addCharge(owner.id, input.charges.cost);
		else if (input.type === "deposit")
			addCharge(input.query.selector.itemId, input.charges.cost);
		else return undefined;
	}

	const availability = yield* readEditorEstimateAvailabilityRequirementsFx({
		rules: line.rules,
		source: "line-condition",
	});
	return {
		chargeCostsByItemId,
		line,
		owner,
		requirements: combineRequirements(
			{
				allOf: requirements,
				anyOf: [],
			},
			availability,
		),
	} satisfies LineDescriptor;
});

const readLineRoutesFx = Effect.fn("createEditorEstimateDependencyGraphFx.lineRoutes")(function* (
	config: GameConfigSchema.Type,
	descriptor: LineDescriptor,
) {
	const routes: EditorEstimateRoute[] = [];
	const occurrences = yield* readEditorEstimateOutputOccurrencesFx(descriptor.line.output);
	for (const occurrence of occurrences)
		routes.push({
			durationMs: descriptor.line.runtimeMs,
			id: `line-output:${descriptor.owner.id}:${descriptor.line.id}:${occurrence.id}:${occurrence.factId}`,
			metadata: {
				kind: "line-output",
				lineId: descriptor.line.id,
				ownerItemId: descriptor.owner.id,
			},
			output: {
				factId: occurrence.factId,
				quantityDistribution: occurrence.quantityDistribution,
			},
			requirements: combineRequirements(
				makeOrdinaryLineRequirements(descriptor.requirements),
				occurrence.requirements,
			),
			runMultiplier: 1,
		});

	for (const [chargedItemId, costs] of descriptor.chargeCostsByItemId) {
		const charges = config.items[chargedItemId]?.charges;
		if (charges?.output === undefined || !costs.some((cost) => cost <= charges.amount))
			continue;
		const spendPerRun = costs.reduce((total, cost) => total + cost, 0);
		if (charges.amount % spendPerRun !== 0) continue;
		const runMultiplier = charges.amount / spendPerRun;
		const chargeOutputs = yield* readEditorEstimateOutputOccurrencesFx(charges.output);
		for (const occurrence of chargeOutputs)
			routes.push({
				durationMs: descriptor.line.runtimeMs,
				id: `line-charge-depletion:${descriptor.owner.id}:${descriptor.line.id}:${chargedItemId}:${occurrence.id}:${occurrence.factId}`,
				metadata: {
					chargedItemId,
					kind: "line-charge-depletion",
					lineId: descriptor.line.id,
					ownerItemId: descriptor.owner.id,
				},
				output: {
					factId: occurrence.factId,
					quantityDistribution: occurrence.quantityDistribution,
				},
				requirements: combineRequirements(
					makeChargeDepletionRequirements(
						descriptor.requirements,
						chargedItemId,
						runMultiplier,
					),
					occurrence.requirements,
				),
				runMultiplier,
			});
	}
	return routes;
});

const readMergeRoutesFx = Effect.fn("createEditorEstimateDependencyGraphFx.mergeRoutes")(function* (
	source: ItemSchema.Type,
) {
	const routes: EditorEstimateRoute[] = [];
	const matchedTargetItemIds = new Set<string>();
	for (const [mergeIndex, merge] of (source.merge ?? []).entries()) {
		if (matchedTargetItemIds.has(merge.target.itemId)) continue;
		matchedTargetItemIds.add(merge.target.itemId);
		const requirements = {
			allOf: [
				makeRequirement(
					source.id,
					1,
					"merge-source",
					merge.action === "consume" ? "consume" : "one-time",
				),
				makeRequirement(
					merge.target.itemId,
					1,
					"merge-target",
					merge.effect === "keep" ? "one-time" : "consume",
				),
			],
			anyOf: [],
		};
		const metadata = {
			kind: "merge-output",
			mergeIndex,
			sourceItemId: source.id,
			targetItemId: merge.target.itemId,
		} as const;
		if (merge.effect === "replace")
			routes.push({
				durationMs: 0,
				id: `merge-replacement:${source.id}:${merge.target.itemId}:${mergeIndex}:${merge.result}`,
				metadata,
				output: {
					factId: merge.result,
					quantityDistribution: [
						{
							probability: 1,
							quantity: 1,
						},
					],
				},
				requirements,
				runMultiplier: 1,
			});
		const outputs = yield* readEditorEstimateOutputOccurrencesFx(merge.output);
		for (const output of outputs)
			routes.push({
				durationMs: 0,
				id: `merge-output:${source.id}:${merge.target.itemId}:${mergeIndex}:${output.id}:${output.factId}`,
				metadata,
				output: {
					factId: output.factId,
					quantityDistribution: output.quantityDistribution,
				},
				requirements: combineRequirements(requirements, output.requirements),
				runMultiplier: 1,
			});
	}
	return routes;
});

const readTemporaryRoutesFx = Effect.fn("createEditorEstimateDependencyGraphFx.temporary")(
	function* (item: ItemSchema.Type) {
		if (item.type !== "temporary") return [];
		const outputs = yield* readEditorEstimateOutputOccurrencesFx(item.output);
		return outputs.map(
			(output): EditorEstimateRoute => ({
				durationMs: item.durationMs,
				id: `temporary-expiry:${item.id}:${output.id}:${output.factId}`,
				metadata: {
					itemId: item.id,
					kind: "temporary-expiry",
				},
				output: {
					factId: output.factId,
					quantityDistribution: output.quantityDistribution,
				},
				requirements: combineRequirements(
					{
						allOf: [
							makeRequirement(item.id, 1, "temporary-item", "consume"),
						],
						anyOf: [],
					},
					output.requirements,
				),
				runMultiplier: 1,
			}),
		);
	},
);

/** Compiles canonical authored item acquisition facts without bootstrapping runtime state. */
export const createEditorEstimateDependencyGraphFx = Effect.fn(
	"createEditorEstimateDependencyGraphFx",
)(function* (config: GameConfigSchema.Type) {
	const descriptors: LineDescriptor[] = [];
	for (const item of Object.values(config.items))
		for (const line of readItemLines(item)) {
			const descriptor = yield* readLineDescriptorFx(config, item, line);
			if (descriptor !== undefined) descriptors.push(descriptor);
		}
	const routes: EditorEstimateRoute[] = [];
	for (const descriptor of descriptors)
		routes.push(...(yield* readLineRoutesFx(config, descriptor)));
	for (const item of Object.values(config.items)) {
		routes.push(...(yield* readMergeRoutesFx(item)));
		routes.push(...(yield* readTemporaryRoutesFx(item)));
	}
	const start = readStartQuantityByItemId(config);
	return {
		factIds: Object.keys(config.items).sort((left, right) => left.localeCompare(right)),
		limitations: readLimitations(config),
		roots: [
			...start,
		]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([factId, quantity]) => ({
				factId,
				quantity,
			})),
		routes: routes.sort((left, right) => left.id.localeCompare(right.id)),
	} satisfies EditorEstimateDependencyGraph;
});
