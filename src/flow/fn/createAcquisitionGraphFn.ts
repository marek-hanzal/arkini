import { Order } from "effect";

import type {
	AcquisitionGraph,
	AcquisitionOperation,
	AcquisitionRequirement,
	AcquisitionRoute,
} from "~/flow/type/AcquisitionGraph";
import { readAcquisitionAvailabilityRequirementsFn } from "~/flow/fn/readAcquisitionAvailabilityRequirementsFn";
import { readAcquisitionOutputOccurrencesFn } from "~/flow/fn/readAcquisitionOutputOccurrencesFn";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { compileAcquisitionRootsFn } from "~/flow/fn/compileAcquisitionRootsFn";

// Authored IDs are unrestricted strings; tuple encoding preserves every ownership boundary.
const readAcquisitionIdentityFn = (...parts: ReadonlyArray<string | number>) =>
	JSON.stringify(parts);

const combineRequirementsFn = (
	...groups: ReadonlyArray<AcquisitionRoute["requirements"]>
): AcquisitionRoute["requirements"] => ({
	allOf: groups.flatMap(({ allOf }) => allOf),
	anyOf: groups.flatMap(({ anyOf }) => anyOf),
	unsupported: groups.flatMap(({ unsupported }) => unsupported ?? []),
});

const makeUnitDepletionRequirementsFn = (
	requirements: AcquisitionRoute["requirements"],
	unitOwnerItemUid: string,
): AcquisitionRoute["requirements"] => ({
	...requirements,
	allOf: [
		...requirements.allOf.filter(
			(requirement) =>
				requirement.factId !== unitOwnerItemUid ||
				(requirement.source !== "unit-owner" &&
					requirement.source !== "units-input" &&
					requirement.source !== "owner"),
		),
		{
			factId: unitOwnerItemUid,
			quantity: 1,
			source: "unit-owner",
			usage: "consume",
		},
	],
});

interface UnitCost {
	readonly cost: number;
	readonly from: "self" | "target";
}

interface LineDescriptor {
	readonly unitCostsByItemUid: ReadonlyMap<IdSchema.Type, ReadonlyArray<UnitCost>>;
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
						factId: input.query.selector.itemUid,
						quantity: input.quantity,
					},
				];
			case "units":
				return [
					{
						factId: input.query.selector.itemUid,
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
			factId: owner.uid,
			quantity: 1,
			source: "owner",
			usage: "one-time",
		},
	];
	const unitCostsByItemUid = new Map<string, UnitCost[]>();
	const addUnitFn = (itemUid: string, cost: UnitCost) => {
		const costs = unitCostsByItemUid.get(itemUid) ?? [];
		costs.push(cost);
		unitCostsByItemUid.set(itemUid, costs);
	};

	for (const input of line.input) {
		if (input.type === "materials")
			requirements.push({
				factId: input.query.selector.itemUid,
				quantity: input.quantity.min,
				source: "material-input",
				usage: input.mode === "consume" ? "consume" : "ongoing",
			});
		if (input.type === "units")
			requirements.push({
				factId: input.query.selector.itemUid,
				quantity: 1,
				source: "units-input",
				usage: "one-time",
			});
		if (input.units === undefined) continue;
		if (input.units.from === "self")
			addUnitFn(owner.uid, {
				cost: input.units.cost,
				from: "self",
			});
		else if (input.type === "units")
			addUnitFn(input.query.selector.itemUid, {
				cost: input.units.cost,
				from: "target",
			});
		else continue;
	}

	const availability = readAcquisitionAvailabilityRequirementsFn({
		rules: line.rules,
		source: "line-condition",
	});
	return {
		unitCostsByItemUid,
		line,
		operation: {
			id: readAcquisitionIdentityFn("source", owner.uid, "line", line.id),
			inputs: readLineOperationInputsFn(line),
		},
		owner,
		requirements: combineRequirementsFn(
			{
				allOf: requirements,
				anyOf: [],
			},
			availability,
			owner.clock !== undefined && owner.ui === "simple" && !line.default
				? readAcquisitionAvailabilityRequirementsFn({
						rules: owner.clock.rules,
						source: "line-condition",
					})
				: {
						allOf: [],
						anyOf: [],
					},
		),
	} satisfies LineDescriptor;
};

const readLineExecutionConstraintFn = (
	owner: ItemSchema.Type,
	line: LineSchema.Type,
): AcquisitionRoute["executionConstraint"] => {
	const clock = owner.clock;
	if (line.default) return clock?.durationMs === undefined ? undefined : "finite-owner-lifetime";
	if (clock === undefined) return owner.ui === "simple" ? "unavailable" : undefined;
	if (
		owner.ui === "simple" &&
		(clock.intervalMs === undefined ||
			!line.clock ||
			(!clock.enable && !clock.rules.some(({ type }) => type === "enable")))
	)
		return "unavailable";
	if (clock.durationMs !== undefined) return "finite-owner-lifetime";
	const pool = owner.lines.filter(
		(candidate) =>
			candidate.clock &&
			(candidate.enable || candidate.rules.some(({ type }) => type === "enable")),
	);
	// Competing lines share one pulse. Per-line cadence cannot preserve shared
	// outputs or cross-line co-products, even when eligibility never changes.
	if (owner.ui === "simple" && pool.length > 1) return "weighted-clock-pool";
	return undefined;
};

const readLineRoutesFn = (config: GameConfigSchema.Type, descriptor: LineDescriptor) => {
	const routes: AcquisitionRoute[] = [];
	const unitUses: NonNullable<AcquisitionRoute["unitUses"]>[number][] = [];
	for (const [unitOwnerItemUid, costs] of descriptor.unitCostsByItemUid) {
		const units = config.items[unitOwnerItemUid]?.units;
		const spendPerRun = costs.reduce((total, { cost }) => total + cost, 0);
		if (units === undefined || spendPerRun <= 0) continue;
		const accounting =
			spendPerRun <= units.amount &&
			new Set(costs.map(({ cost }) => cost)).size === 1 &&
			new Set(costs.map(({ from }) => from)).size === 1
				? "single-payer-exact"
				: "multi-payer-unsupported";
		unitUses.push({
			accounting,
			payerFactId: unitOwnerItemUid,
			usableActionRuns:
				accounting === "single-payer-exact" ? Math.floor(units.amount / spendPerRun) : 0,
		});
	}
	const executionConstraint = readLineExecutionConstraintFn(descriptor.owner, descriptor.line);
	const minimumActionIntervalMs =
		descriptor.owner.clock !== undefined &&
		descriptor.owner.ui === "simple" &&
		!descriptor.line.default
			? descriptor.owner.clock.intervalMs
			: undefined;
	const execution = {
		...(executionConstraint === undefined
			? {}
			: {
					executionConstraint,
				}),
		...(minimumActionIntervalMs === undefined
			? {}
			: {
					minimumActionIntervalMs,
				}),
	};
	const outputModel = readAcquisitionOutputOccurrencesFn(descriptor.line.outcome);
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
			...execution,
			...(unitUses.length === 0
				? {}
				: {
						unitUses,
					}),
			durationMs: descriptor.line.runtimeMs,
			id: readAcquisitionIdentityFn(
				"line-output",
				descriptor.owner.uid,
				descriptor.line.id,
				occurrence.id,
				occurrence.factId,
			),
			metadata: {
				kind: "line-output",
				lineId: descriptor.line.id,
				lineTitle: descriptor.line.title,
				ownerItemUid: descriptor.owner.uid,
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

	for (const [unitOwnerItemUid, costs] of descriptor.unitCostsByItemUid) {
		const units = config.items[unitOwnerItemUid]?.units;
		const spendPerRun = costs.reduce((total, { cost }) => total + cost, 0);
		if (units?.outcome === undefined || spendPerRun > units.amount) continue;
		if (units.amount % spendPerRun !== 0) continue;
		const runMultiplier = units.amount / spendPerRun;
		const unitOutputModel = readAcquisitionOutputOccurrencesFn(units.outcome);
		for (const occurrence of unitOutputModel.occurrences)
			routes.push({
				...execution,
				unitUses: unitUses.filter(({ payerFactId }) => payerFactId !== unitOwnerItemUid),
				durationMs: descriptor.line.runtimeMs,
				id: readAcquisitionIdentityFn(
					"line-unit-depletion",
					descriptor.owner.uid,
					descriptor.line.id,
					unitOwnerItemUid,
					occurrence.id,
					occurrence.factId,
				),
				metadata: {
					unitOwnerItemUid,
					kind: "line-unit-depletion",
					lineId: descriptor.line.id,
					lineTitle: descriptor.line.title,
					ownerItemUid: descriptor.owner.uid,
				},
				operation: {
					id: readAcquisitionIdentityFn("source", unitOwnerItemUid, "units"),
					inputs: [],
					...(unitOutputModel.compilation === "complete"
						? {}
						: {
								outputCompilation: unitOutputModel.compilation,
							}),
					outputDistribution: unitOutputModel.outputDistribution,
				},
				output: {
					annotation: occurrence.annotation,
					factId: occurrence.factId,
					operationOutputGroupId: occurrence.operationOutputGroupId,
					quantityDistribution: occurrence.quantityDistribution,
				},
				requirements: combineRequirementsFn(
					makeUnitDepletionRequirementsFn(descriptor.requirements, unitOwnerItemUid),
					occurrence.requirements,
				),
				runMultiplier,
			});
	}
	return routes;
};

/** Compiles line-output and exact unit-depletion acquisition routes. */
const compileAcquisitionLineRoutesFn = (config: GameConfigSchema.Type) => {
	const routes: AcquisitionRoute[] = [];
	for (const item of Object.values(config.items))
		for (const line of item.lines) {
			const descriptor = readLineDescriptorFn(item, line);
			if (descriptor !== undefined) routes.push(...readLineRoutesFn(config, descriptor));
		}
	return routes;
};

const readMergeRoutesFn = (config: GameConfigSchema.Type, source: ItemSchema.Type) => {
	const routes: AcquisitionRoute[] = [];
	const matchedTargetItemUids = new Set<string>();
	for (const [mergeIndex, merge] of (source.merge ?? []).entries()) {
		// Anonymous transported sources have no exact acquisition requirement in this graph.
		if (merge.action === "space") continue;
		if (matchedTargetItemUids.has(merge.target.itemUid)) continue;
		matchedTargetItemUids.add(merge.target.itemUid);
		const requirements: AcquisitionRoute["requirements"] = {
			allOf: [
				{
					factId: source.uid,
					...(source.uid === merge.target.itemUid
						? {
								identity: "distinct" as const,
							}
						: {}),
					quantity: 1,
					source: "merge-source",
					usage: merge.action === "consume" ? "consume" : "one-time",
				},
				{
					factId: merge.target.itemUid,
					...(source.uid === merge.target.itemUid
						? {
								identity: "distinct" as const,
							}
						: {}),
					quantity: 1,
					source: "merge-target",
					usage:
						merge.effect === "remove" || merge.effect === "replace"
							? "consume"
							: "one-time",
				},
			],
			anyOf: [],
		};
		const target = config.items[merge.target.itemUid];
		const unitParticipants = [
			...(merge.action === "spend" && source.units !== undefined
				? [
						{
							units: source.units,
							itemUid: source.uid,
							requirementSource: "merge-source" as const,
							role: "source" as const,
						},
					]
				: []),
			...(merge.effect === "spend" && target?.units !== undefined
				? [
						{
							units: target.units,
							itemUid: target.uid,
							requirementSource: "merge-target" as const,
							role: "target" as const,
						},
					]
				: []),
		];
		const unitUses = unitParticipants.map(({ units, itemUid }) => ({
			accounting: "single-payer-exact" as const,
			payerFactId: itemUid,
			usableActionRuns: units.amount,
		}));
		const metadata = {
			kind: "merge-output",
			mergeIndex,
			sourceItemUid: source.uid,
			targetItemUid: merge.target.itemUid,
		} as const;
		const outputModel = readAcquisitionOutputOccurrencesFn(merge.outcome);
		const replacementOutputGroupId = "output:replacement";
		const operation = {
			id: readAcquisitionIdentityFn("source", source.uid, "merge", mergeIndex),
			inputs: [
				{
					factId: merge.target.itemUid,
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
				...(unitUses.length === 0
					? {}
					: {
							unitUses,
						}),
				durationMs: 0,
				id: readAcquisitionIdentityFn(
					"merge-replacement",
					source.uid,
					merge.target.itemUid,
					mergeIndex,
					merge.result,
				),
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
				...(unitUses.length === 0
					? {}
					: {
							unitUses,
						}),
				durationMs: 0,
				id: readAcquisitionIdentityFn(
					"merge-output",
					source.uid,
					merge.target.itemUid,
					mergeIndex,
					output.id,
					output.factId,
				),
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

		for (const [participantIndex, participant] of unitParticipants.entries()) {
			if (participant.units.outcome === undefined) continue;
			const unitOutputModel = readAcquisitionOutputOccurrencesFn(participant.units.outcome);
			const depletionRequirements: AcquisitionRoute["requirements"] = {
				...requirements,
				allOf: requirements.allOf.map((requirement) =>
					requirement.factId === participant.itemUid &&
					requirement.source === participant.requirementSource
						? {
								...requirement,
								source: "unit-owner" as const,
								usage: "consume" as const,
							}
						: requirement,
				),
			};
			for (const output of unitOutputModel.occurrences)
				routes.push({
					unitUses: unitUses.filter((_unitUse, index) => index !== participantIndex),
					durationMs: 0,
					id: readAcquisitionIdentityFn(
						"merge-unit-depletion",
						source.uid,
						merge.target.itemUid,
						mergeIndex,
						participant.role,
						output.id,
						output.factId,
					),
					metadata: {
						unitOwnerItemUid: participant.itemUid,
						kind: "merge-unit-depletion",
						mergeIndex,
						sourceItemUid: source.uid,
						targetItemUid: merge.target.itemUid,
					},
					operation: {
						id: readAcquisitionIdentityFn("source", participant.itemUid, "units"),
						inputs: [],
						...(unitOutputModel.compilation === "complete"
							? {}
							: {
									outputCompilation: unitOutputModel.compilation,
								}),
						outputDistribution: unitOutputModel.outputDistribution,
					},
					output: {
						annotation: output.annotation,
						factId: output.factId,
						operationOutputGroupId: output.operationOutputGroupId,
						quantityDistribution: output.quantityDistribution,
					},
					requirements: combineRequirementsFn(depletionRequirements, output.requirements),
					runMultiplier: participant.units.amount,
				});
		}
	}
	return routes;
};

/** Compiles merge-output and replacement acquisition routes. */
const compileAcquisitionMergeRoutesFn = (config: GameConfigSchema.Type) => {
	const routes: AcquisitionRoute[] = [];
	for (const item of Object.values(config.items)) {
		routes.push(...readMergeRoutesFn(config, item));
	}
	return routes;
};

const readExpiryRoutesFn = (item: ItemSchema.Type) => {
	const clock = item.clock;
	const durationMs = clock?.durationMs;
	if (clock === undefined || durationMs === undefined) return [];
	const kind = "clock-expiry";
	const outputModel = readAcquisitionOutputOccurrencesFn(clock.onExpire);
	return outputModel.occurrences.map(
		(output): AcquisitionRoute => ({
			...(!clock.enable && !clock.rules.some(({ type }) => type === "enable")
				? {
						executionConstraint: "unavailable" as const,
					}
				: item.lines.length > 0
					? {
							executionConstraint: "finite-owner-lifetime" as const,
						}
					: {}),
			durationMs,
			id: readAcquisitionIdentityFn(kind, item.uid, output.id, output.factId),
			metadata: {
				itemUid: item.uid,
				kind,
			},
			operation: {
				id: readAcquisitionIdentityFn("source", item.uid, "expiry"),
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
			requirements: combineRequirementsFn(
				{
					allOf: [
						{
							factId: item.uid,
							quantity: 1,
							source: "expiring-item",
							usage: "consume",
						},
						...output.requirements.allOf,
					],
					anyOf: output.requirements.anyOf,
					unsupported: output.requirements.unsupported ?? [],
				},
				readAcquisitionAvailabilityRequirementsFn({
					rules: clock.rules,
					source: "line-condition",
				}),
			),
			runMultiplier: 1,
		}),
	);
};

/** Compiles finite-owner expiry acquisition routes through the shared output model. */
const compileAcquisitionExpiryRoutesFn = (config: GameConfigSchema.Type) => {
	const routes: AcquisitionRoute[] = [];
	for (const item of Object.values(config.items)) {
		routes.push(...readExpiryRoutesFn(item));
	}
	return routes;
};

/** Composes canonical authored acquisition facts and routes in deterministic order. */
export const createAcquisitionGraphFn = (config: GameConfigSchema.Type) => {
	const roots = compileAcquisitionRootsFn(config);
	const routes = [
		...compileAcquisitionLineRoutesFn(config),
		...compileAcquisitionMergeRoutesFn(config),
		...compileAcquisitionExpiryRoutesFn(config),
	].sort((left, right) => Order.String(left.id, right.id));

	return {
		factIds: Object.keys(config.items).sort(Order.String),
		limitations: roots.limitations,
		roots: roots.roots,
		routes,
	} satisfies AcquisitionGraph;
};
