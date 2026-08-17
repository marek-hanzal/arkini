import { Effect } from "effect";

import type {
	EditorAcquisitionGraph,
	EditorAcquisitionLimitation,
	EditorAcquisitionOperation,
	EditorAcquisitionRequirement,
	EditorAcquisitionRoute,
} from "~/editor/EditorAcquisitionGraph";
import { readEditorAcquisitionAvailabilityRequirementsFx } from "~/editor/readEditorAcquisitionAvailabilityRequirementsFx";
import { readEditorAcquisitionOutputOccurrencesFx } from "~/editor/readEditorAcquisitionOutputOccurrencesFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

interface ChargeCost {
	readonly cost: number;
	readonly from: "self" | "target";
}

interface LineDescriptor {
	readonly chargeCostsByItemId: ReadonlyMap<IdSchema.Type, ReadonlyArray<ChargeCost>>;
	readonly line: LineSchema.Type;
	readonly operation: EditorAcquisitionOperation;
	readonly owner: ItemSchema.Type;
	readonly requirements: EditorAcquisitionRoute["requirements"];
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

const requiresAbsentFact = (when: WhenSchema.Type) => {
	switch (when.type) {
		case "exists":
			return true;
		case "count":
			return when.count > 0;
		case "range":
			return when.min > 0;
	}
};

const readLimitations = (config: GameConfigSchema.Type) => {
	const limitations = new Set<EditorAcquisitionLimitation>();
	for (const item of Object.values(config.items)) {
		for (const line of readItemLines(item)) {
			if (
				line.rules.some(
					(rule) => rule.type === "disable" && rule.when.some(requiresAbsentFact),
				)
			)
				limitations.add("negative-availability-constraints-ignored");
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
			readItemOutputs(item).some((output) =>
				readOutputDrops(output).some(({ rules }) => {
					if (
						rules.some(
							(rule) => rule.type === "disable" && rule.when.some(requiresAbsentFact),
						)
					)
						limitations.add("negative-availability-constraints-ignored");
					return rules.length > 0;
				}),
			)
		)
			limitations.add("spatial-requirements-approximated");
	}
	return [
		...limitations,
	].sort((left, right) => left.localeCompare(right));
};

const combineRequirements = (
	...groups: ReadonlyArray<EditorAcquisitionRoute["requirements"]>
): EditorAcquisitionRoute["requirements"] => ({
	allOf: groups.flatMap(({ allOf }) => allOf),
	anyOf: groups.flatMap(({ anyOf }) => anyOf),
	unsupported: groups.flatMap(({ unsupported }) => unsupported ?? []),
});

const makeOrdinaryLineRequirements = (
	requirements: EditorAcquisitionRoute["requirements"],
	chargedItemIds: ReadonlySet<string>,
): EditorAcquisitionRoute["requirements"] => ({
	...requirements,
	allOf: requirements.allOf.filter(
		(requirement) =>
			!(
				[
					"deposit-input",
					"owner",
				] as const
			).includes(requirement.source as "deposit-input" | "owner") ||
			!chargedItemIds.has(requirement.factId),
	),
});

const makeChargeDepletionRequirements = (
	requirements: EditorAcquisitionRoute["requirements"],
	chargedItemId: string,
): EditorAcquisitionRoute["requirements"] => ({
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
		makeRequirement(chargedItemId, 1, "charged-item", "consume"),
	],
});

const makeRequirement = (
	factId: string,
	quantity: number,
	source: EditorAcquisitionRequirement["source"],
	usage: EditorAcquisitionRequirement["usage"],
): EditorAcquisitionRequirement => ({
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

const readLineOperationInputs = (line: LineSchema.Type) =>
	line.input.flatMap((input) => {
		switch (input.type) {
			case "simple":
				return [];
			case "materials":
				return [
					{
						factId: input.selector.itemId,
						quantity: input.quantity,
					},
				];
			case "deposit":
				return [
					{
						factId: input.query.selector.itemId,
						quantity: {
							max: 1,
							min: 1,
						},
					},
				];
		}
	});

const readLineDescriptorFx = Effect.fn("createEditorAcquisitionGraphFx.line")(function* (
	config: GameConfigSchema.Type,
	owner: ItemSchema.Type,
	line: LineSchema.Type,
) {
	if (!line.enable && !line.rules.some(({ type }) => type === "enable")) return undefined;
	const requirements: EditorAcquisitionRequirement[] = [
		makeRequirement(owner.id, 1, "owner", "one-time"),
	];
	const chargeCostsByItemId = new Map<string, ChargeCost[]>();
	const addCharge = (itemId: string, cost: ChargeCost) => {
		const costs = chargeCostsByItemId.get(itemId) ?? [];
		costs.push(cost);
		chargeCostsByItemId.set(itemId, costs);
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
		if (input.charges.from === "self")
			addCharge(owner.id, {
				cost: input.charges.cost,
				from: "self",
			});
		else if (input.type === "deposit")
			addCharge(input.query.selector.itemId, {
				cost: input.charges.cost,
				from: "target",
			});
		else return undefined;
	}
	for (const [itemId, costs] of chargeCostsByItemId) {
		const payer = config.items[itemId];
		const capacity = payer?.charges?.amount;
		if (capacity === undefined || costs.some(({ cost }) => cost > capacity)) return undefined;
		const selfSpend = costs.reduce(
			(total, charge) => total + (charge.from === "self" ? charge.cost : 0),
			0,
		);
		if (selfSpend > capacity) return undefined;
		const targetSpend = costs.reduce(
			(total, charge) => total + (charge.from === "target" ? charge.cost : 0),
			0,
		);
		if (payer.maxCount !== undefined && targetSpend > capacity * payer.maxCount)
			return undefined;
	}

	const availability = yield* readEditorAcquisitionAvailabilityRequirementsFx({
		rules: line.rules,
		source: "line-condition",
	});
	return {
		chargeCostsByItemId,
		line,
		operation: {
			id: `source:${owner.id}:line:${line.id}`,
			inputs: readLineOperationInputs(line),
		},
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

const readLineRoutesFx = Effect.fn("createEditorAcquisitionGraphFx.lineRoutes")(function* (
	config: GameConfigSchema.Type,
	descriptor: LineDescriptor,
) {
	const routes: EditorAcquisitionRoute[] = [];
	const chargeUses: NonNullable<EditorAcquisitionRoute["chargeUses"]>[number][] = [];
	for (const [chargedItemId, costs] of descriptor.chargeCostsByItemId) {
		const payer = config.items[chargedItemId];
		const charges = payer?.charges;
		const spendPerRun = costs.reduce((total, { cost }) => total + cost, 0);
		if (charges === undefined || spendPerRun <= 0) continue;
		const accounting =
			spendPerRun <= charges.amount &&
			new Set(costs.map(({ cost }) => cost)).size === 1 &&
			new Set(costs.map(({ from }) => from)).size === 1
				? "single-payer-exact"
				: "multi-payer-unsupported";
		chargeUses.push({
			accounting,
			payerFactId: chargedItemId,
			usableActionRuns:
				accounting === "single-payer-exact" ? Math.floor(charges.amount / spendPerRun) : 0,
		});
	}
	const chargedItemIds = new Set(chargeUses.map(({ payerFactId }) => payerFactId));
	const outputModel = yield* readEditorAcquisitionOutputOccurrencesFx(descriptor.line.output);
	const operation = {
		...descriptor.operation,
		...(outputModel.compilation === "complete"
			? {}
			: {
					outputCompilation: outputModel.compilation,
				}),
		outputDistribution: outputModel.outputDistribution,
	};
	const occurrences = outputModel.occurrences;
	for (const occurrence of occurrences)
		routes.push({
			...(chargeUses.length === 0
				? {}
				: {
						chargeUses,
					}),
			durationMs: descriptor.line.runtimeMs,
			id: `line-output:${descriptor.owner.id}:${descriptor.line.id}:${occurrence.id}:${occurrence.factId}`,
			metadata: {
				kind: "line-output",
				lineId: descriptor.line.id,
				lineTitle: descriptor.line.title,
				ownerItemId: descriptor.owner.id,
			},
			operation,
			output: {
				annotation: occurrence.annotation,
				factId: occurrence.factId,
				operationOutputGroupId: occurrence.operationOutputGroupId,
				quantityDistribution: occurrence.quantityDistribution,
			},
			requirements: combineRequirements(
				makeOrdinaryLineRequirements(descriptor.requirements, chargedItemIds),
				occurrence.requirements,
			),
			runMultiplier: 1,
		});

	for (const [chargedItemId, costs] of descriptor.chargeCostsByItemId) {
		const charges = config.items[chargedItemId]?.charges;
		const spendPerRun = costs.reduce((total, { cost }) => total + cost, 0);
		if (charges?.output === undefined || spendPerRun > charges.amount) continue;
		if (charges.amount % spendPerRun !== 0) continue;
		const runMultiplier = charges.amount / spendPerRun;
		const chargeOutputModel = yield* readEditorAcquisitionOutputOccurrencesFx(charges.output);
		for (const occurrence of chargeOutputModel.occurrences)
			routes.push({
				chargeUses: chargeUses.filter(({ payerFactId }) => payerFactId !== chargedItemId),
				durationMs: descriptor.line.runtimeMs,
				id: `line-charge-depletion:${descriptor.owner.id}:${descriptor.line.id}:${chargedItemId}:${occurrence.id}:${occurrence.factId}`,
				metadata: {
					chargedItemId,
					kind: "line-charge-depletion",
					lineId: descriptor.line.id,
					lineTitle: descriptor.line.title,
					ownerItemId: descriptor.owner.id,
				},
				operation: {
					id: `source:${chargedItemId}:charges`,
					inputs: [],
					...(chargeOutputModel.compilation === "complete"
						? {}
						: {
								outputCompilation: chargeOutputModel.compilation,
							}),
					outputDistribution: chargeOutputModel.outputDistribution,
				},
				output: {
					annotation: occurrence.annotation,
					factId: occurrence.factId,
					operationOutputGroupId: occurrence.operationOutputGroupId,
					quantityDistribution: occurrence.quantityDistribution,
				},
				requirements: combineRequirements(
					makeChargeDepletionRequirements(descriptor.requirements, chargedItemId),
					occurrence.requirements,
				),
				runMultiplier,
			});
	}
	return routes;
});

const readMergeRoutesFx = Effect.fn("createEditorAcquisitionGraphFx.mergeRoutes")(function* (
	source: ItemSchema.Type,
) {
	const routes: EditorAcquisitionRoute[] = [];
	const matchedTargetItemIds = new Set<string>();
	for (const [mergeIndex, merge] of (source.merge ?? []).entries()) {
		if (matchedTargetItemIds.has(merge.target.itemId)) continue;
		matchedTargetItemIds.add(merge.target.itemId);
		const requirements = {
			allOf: [
				{
					...makeRequirement(
						source.id,
						1,
						"merge-source",
						merge.action === "consume" ? "consume" : "one-time",
					),
					...(source.id === merge.target.itemId
						? {
								identity: "distinct" as const,
							}
						: {}),
				},
				{
					...makeRequirement(
						merge.target.itemId,
						1,
						"merge-target",
						merge.effect === "keep" ? "one-time" : "consume",
					),
					...(source.id === merge.target.itemId
						? {
								identity: "distinct" as const,
							}
						: {}),
				},
			],
			anyOf: [],
		};
		const metadata = {
			kind: "merge-output",
			mergeIndex,
			sourceItemId: source.id,
			targetItemId: merge.target.itemId,
		} as const;
		const outputModel = yield* readEditorAcquisitionOutputOccurrencesFx(merge.output);
		const replacementOutputGroupId = "output:replacement";
		const operation = {
			id: `source:${source.id}:merge:${mergeIndex}`,
			inputs: [
				{
					factId: merge.target.itemId,
					quantity: {
						max: 1,
						min: 1,
					},
				},
			],
			...(outputModel.compilation === "complete"
				? {}
				: {
						outputCompilation: outputModel.compilation,
					}),
			outputDistribution: outputModel.outputDistribution.map((outcome) => ({
				...outcome,
				quantities:
					merge.effect === "replace"
						? [
								...outcome.quantities,
								{
									outputGroupId: replacementOutputGroupId,
									quantity: 1,
								},
							]
						: outcome.quantities,
			})),
		} satisfies EditorAcquisitionOperation;
		if (merge.effect === "replace")
			routes.push({
				durationMs: 0,
				id: `merge-replacement:${source.id}:${merge.target.itemId}:${mergeIndex}:${merge.result}`,
				metadata,
				operation,
				output: {
					annotation: {
						alternativeSet: false,
						placement: undefined,
						quantity: {
							max: 1,
							min: 1,
						},
						selectionKind: "replace",
					},
					factId: merge.result,
					operationOutputGroupId: replacementOutputGroupId,
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
		for (const output of outputModel.occurrences)
			routes.push({
				durationMs: 0,
				id: `merge-output:${source.id}:${merge.target.itemId}:${mergeIndex}:${output.id}:${output.factId}`,
				metadata,
				operation,
				output: {
					annotation: output.annotation,
					factId: output.factId,
					operationOutputGroupId: output.operationOutputGroupId,
					quantityDistribution: output.quantityDistribution,
				},
				requirements: combineRequirements(requirements, output.requirements),
				runMultiplier: 1,
			});
	}
	return routes;
});

const readTemporaryRoutesFx = Effect.fn("createEditorAcquisitionGraphFx.temporary")(function* (
	item: ItemSchema.Type,
) {
	if (item.type !== "temporary") return [];
	const outputModel = yield* readEditorAcquisitionOutputOccurrencesFx(item.output);
	return outputModel.occurrences.map(
		(output): EditorAcquisitionRoute => ({
			durationMs: item.durationMs,
			id: `temporary-expiry:${item.id}:${output.id}:${output.factId}`,
			metadata: {
				itemId: item.id,
				kind: "temporary-expiry",
			},
			operation: {
				id: `source:${item.id}:expiry`,
				inputs: [],
				...(outputModel.compilation === "complete"
					? {}
					: {
							outputCompilation: outputModel.compilation,
						}),
				outputDistribution: outputModel.outputDistribution,
			},
			output: {
				annotation: output.annotation,
				factId: output.factId,
				operationOutputGroupId: output.operationOutputGroupId,
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
});

/** Compiles canonical authored item acquisition facts without bootstrapping runtime state. */
export const createEditorAcquisitionGraphFx = Effect.fn("createEditorAcquisitionGraphFx")(
	function* (config: GameConfigSchema.Type) {
		const descriptors: LineDescriptor[] = [];
		for (const item of Object.values(config.items))
			for (const line of readItemLines(item)) {
				const descriptor = yield* readLineDescriptorFx(config, item, line);
				if (descriptor !== undefined) descriptors.push(descriptor);
			}
		const routes: EditorAcquisitionRoute[] = [];
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
		} satisfies EditorAcquisitionGraph;
	},
);
