import { Order } from "effect";

import type {
	AcquisitionGraph,
	AcquisitionOperation,
	AcquisitionRequirement,
	AcquisitionRoute,
} from "~/flow/type/AcquisitionGraph";
import { readAcquisitionAvailabilityRequirementsFn } from "~/flow/fn/readAcquisitionAvailabilityRequirementsFn";
import { readAcquisitionOutputOccurrencesFn } from "~/flow/fn/readAcquisitionOutputOccurrencesFn";
import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { readAuthoredItemLinesFn } from "~/production-line/fn/readAuthoredItemLinesFn";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { compileAcquisitionRootsFn } from "~/flow/fn/compileAcquisitionRootsFn";

const combineRequirementsFn = (
	...groups: ReadonlyArray<AcquisitionRoute["requirements"]>
): AcquisitionRoute["requirements"] => ({
	allOf: groups.flatMap(({ allOf }) => allOf),
	anyOf: groups.flatMap(({ anyOf }) => anyOf),
	unsupported: groups.flatMap(({ unsupported }) => unsupported ?? []),
});

const makeChargeDepletionRequirementsFn = (
	requirements: AcquisitionRoute["requirements"],
	chargedItemId: string,
): AcquisitionRoute["requirements"] => ({
	...requirements,
	allOf: [
		...requirements.allOf.filter(
			(requirement) =>
				requirement.factId !== chargedItemId ||
				(requirement.source !== "charged-item" &&
					requirement.source !== "deposit-input" &&
					requirement.source !== "owner"),
		),
		{
			factId: chargedItemId,
			quantity: 1,
			source: "charged-item",
			usage: "consume",
		},
	],
});

interface ChargeCost {
	readonly cost: number;
	readonly from: "self" | "target";
}

interface LineDescriptor {
	readonly chargeCostsByItemId: ReadonlyMap<IdSchema.Type, ReadonlyArray<ChargeCost>>;
	readonly line: LineSchema.Type;
	readonly operation: AcquisitionOperation;
	readonly owner: ItemSchema.Type;
	readonly requirements: AcquisitionRoute["requirements"];
}

const readLineOperationInputsFn = (line: LineSchema.Type) =>
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

const readLineDescriptorFn = (owner: ItemSchema.Type, line: LineSchema.Type) => {
	if (!line.enable && !line.rules.some(({ type }) => type === "enable")) return undefined;
	const requirements: AcquisitionRequirement[] = [
		{
			factId: owner.id,
			quantity: 1,
			source: "owner",
			usage: "one-time",
		},
	];
	const chargeCostsByItemId = new Map<string, ChargeCost[]>();
	const addChargeFn = (itemId: string, cost: ChargeCost) => {
		const costs = chargeCostsByItemId.get(itemId) ?? [];
		costs.push(cost);
		chargeCostsByItemId.set(itemId, costs);
	};

	for (const input of line.input) {
		if (input.type === "materials")
			requirements.push({
				factId: input.selector.itemId,
				quantity: input.quantity.min,
				source: "material-input",
				usage: input.mode === "consume" ? "consume" : "ongoing",
			});
		if (input.type === "deposit")
			requirements.push({
				factId: input.query.selector.itemId,
				quantity: 1,
				source: "deposit-input",
				usage: "one-time",
			});
		if (input.charges === undefined) continue;
		if (input.charges.from === "self")
			addChargeFn(owner.id, {
				cost: input.charges.cost,
				from: "self",
			});
		else if (input.type === "deposit")
			addChargeFn(input.query.selector.itemId, {
				cost: input.charges.cost,
				from: "target",
			});
		else continue;
	}

	const availability = readAcquisitionAvailabilityRequirementsFn({
		rules: line.rules,
		source: "line-condition",
	});
	return {
		chargeCostsByItemId,
		line,
		operation: {
			id: `source:${owner.id}:line:${line.id}`,
			inputs: readLineOperationInputsFn(line),
		},
		owner,
		requirements: combineRequirementsFn(
			{
				allOf: requirements,
				anyOf: [],
			},
			availability,
		),
	} satisfies LineDescriptor;
};

const readLineRoutesFn = (config: GameConfigSchema.Type, descriptor: LineDescriptor) => {
	const routes: AcquisitionRoute[] = [];
	const chargeUses: NonNullable<AcquisitionRoute["chargeUses"]>[number][] = [];
	for (const [chargedItemId, costs] of descriptor.chargeCostsByItemId) {
		const charges = config.items[chargedItemId]?.charges;
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
	const outputModel = readAcquisitionOutputOccurrencesFn(descriptor.line.output);
	const operation = {
		...descriptor.operation,
		...(outputModel.compilation === "complete"
			? {}
			: {
					outputCompilation: outputModel.compilation,
				}),
		outputDistribution: outputModel.outputDistribution,
	};
	for (const occurrence of outputModel.occurrences)
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
			requirements: combineRequirementsFn(descriptor.requirements, occurrence.requirements),
			runMultiplier: 1,
		});

	for (const [chargedItemId, costs] of descriptor.chargeCostsByItemId) {
		const charges = config.items[chargedItemId]?.charges;
		const spendPerRun = costs.reduce((total, { cost }) => total + cost, 0);
		if (charges?.output === undefined || spendPerRun > charges.amount) continue;
		if (charges.amount % spendPerRun !== 0) continue;
		const runMultiplier = charges.amount / spendPerRun;
		const chargeOutputModel = readAcquisitionOutputOccurrencesFn(charges.output);
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
				requirements: combineRequirementsFn(
					makeChargeDepletionRequirementsFn(descriptor.requirements, chargedItemId),
					occurrence.requirements,
				),
				runMultiplier,
			});
	}
	return routes;
};

/** Compiles line-output and exact charge-depletion acquisition routes. */
const compileAcquisitionLineRoutesFn = (config: GameConfigSchema.Type) => {
	const routes: AcquisitionRoute[] = [];
	for (const item of Object.values(config.items))
		for (const line of readAuthoredItemLinesFn(item)) {
			const descriptor = readLineDescriptorFn(item, line);
			if (descriptor !== undefined) routes.push(...readLineRoutesFn(config, descriptor));
		}
	return routes;
};

const readMergeRoutesFn = (source: ItemSchema.Type) => {
	const routes: AcquisitionRoute[] = [];
	const matchedTargetItemIds = new Set<string>();
	for (const [mergeIndex, merge] of (source.merge ?? []).entries()) {
		if (matchedTargetItemIds.has(merge.target.itemId)) continue;
		matchedTargetItemIds.add(merge.target.itemId);
		const requirements: AcquisitionRoute["requirements"] = {
			allOf: [
				{
					factId: source.id,
					...(source.id === merge.target.itemId
						? {
								identity: "distinct" as const,
							}
						: {}),
					quantity: 1,
					source: "merge-source",
					usage: merge.action === "consume" ? "consume" : "one-time",
				},
				{
					factId: merge.target.itemId,
					...(source.id === merge.target.itemId
						? {
								identity: "distinct" as const,
							}
						: {}),
					quantity: 1,
					source: "merge-target",
					usage: merge.effect === "keep" ? "one-time" : "consume",
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
		const outputModel = readAcquisitionOutputOccurrencesFn(merge.output);
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
		} satisfies AcquisitionOperation;
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
				requirements: combineRequirementsFn(requirements, output.requirements),
				runMultiplier: 1,
			});
	}
	return routes;
};

/** Compiles merge-output and replacement acquisition routes. */
const compileAcquisitionMergeRoutesFn = (config: GameConfigSchema.Type) => {
	const routes: AcquisitionRoute[] = [];
	for (const item of Object.values(config.items)) {
		routes.push(...readMergeRoutesFn(item));
	}
	return routes;
};

const readTemporaryRoutesFn = (item: ItemSchema.Type) => {
	if (item.type !== "temporary") return [];
	const outputModel = readAcquisitionOutputOccurrencesFn(item.output);
	return outputModel.occurrences.map(
		(output): AcquisitionRoute => ({
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
			requirements: {
				allOf: [
					{
						factId: item.id,
						quantity: 1,
						source: "temporary-item",
						usage: "consume",
					},
					...output.requirements.allOf,
				],
				anyOf: output.requirements.anyOf,
				unsupported: output.requirements.unsupported ?? [],
			},
			runMultiplier: 1,
		}),
	);
};

/** Compiles temporary-expiry acquisition routes. */
const compileAcquisitionTemporaryRoutesFn = (config: GameConfigSchema.Type) => {
	const routes: AcquisitionRoute[] = [];
	for (const item of Object.values(config.items)) {
		routes.push(...readTemporaryRoutesFn(item));
	}
	return routes;
};

/** Composes canonical authored acquisition facts and routes in deterministic order. */
export const createAcquisitionGraphFn = (config: GameConfigSchema.Type) => {
	const roots = compileAcquisitionRootsFn(config);
	const routes = [
		...compileAcquisitionLineRoutesFn(config),
		...compileAcquisitionMergeRoutesFn(config),
		...compileAcquisitionTemporaryRoutesFn(config),
	].sort((left, right) => Order.String(left.id, right.id));

	return {
		factIds: Object.keys(config.items).sort(Order.String),
		limitations: roots.limitations,
		roots: roots.roots,
		routes,
	} satisfies AcquisitionGraph;
};
