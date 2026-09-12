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
import { readAuthoredItemLinesFn } from "~/production-line/fn/readAuthoredItemLinesFn";
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
	unitOwnerItemId: string,
): AcquisitionRoute["requirements"] => ({
	...requirements,
	allOf: [
		...requirements.allOf.filter(
			(requirement) =>
				requirement.factId !== unitOwnerItemId ||
				(requirement.source !== "unit-owner" &&
					requirement.source !== "units-input" &&
					requirement.source !== "owner"),
		),
		{
			factId: unitOwnerItemId,
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
	readonly unitCostsByItemId: ReadonlyMap<IdSchema.Type, ReadonlyArray<UnitCost>>;
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
			case "units":
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
	const unitCostsByItemId = new Map<string, UnitCost[]>();
	const addUnitFn = (itemId: string, cost: UnitCost) => {
		const costs = unitCostsByItemId.get(itemId) ?? [];
		costs.push(cost);
		unitCostsByItemId.set(itemId, costs);
	};

	for (const input of line.input) {
		if (input.type === "materials")
			requirements.push({
				factId: input.selector.itemId,
				quantity: input.quantity.min,
				source: "material-input",
				usage: input.mode === "consume" ? "consume" : "ongoing",
			});
		if (input.type === "units")
			requirements.push({
				factId: input.query.selector.itemId,
				quantity: 1,
				source: "units-input",
				usage: "one-time",
			});
		if (input.units === undefined) continue;
		if (input.units.from === "self")
			addUnitFn(owner.id, {
				cost: input.units.cost,
				from: "self",
			});
		else if (input.type === "units")
			addUnitFn(input.query.selector.itemId, {
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
		unitCostsByItemId,
		line,
		operation: {
			id: readAcquisitionIdentityFn("source", owner.id, "line", line.id),
			inputs: readLineOperationInputsFn(line),
		},
		owner,
		requirements: combineRequirementsFn(
			{
				allOf: requirements,
				anyOf: [],
			},
			availability,
			owner.type === "clock" && owner.control === "automatic-only"
				? readAcquisitionAvailabilityRequirementsFn({
						rules: owner.rules,
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
	if (owner.type !== "clock") return undefined;
	if (
		owner.control === "automatic-only" &&
		(!line.default || (!owner.enable && !owner.rules.some(({ type }) => type === "enable")))
	)
		return "unavailable";
	return owner.durationMs === undefined ? undefined : "finite-owner-lifetime";
};

const readLineRoutesFn = (config: GameConfigSchema.Type, descriptor: LineDescriptor) => {
	const routes: AcquisitionRoute[] = [];
	const unitUses: NonNullable<AcquisitionRoute["unitUses"]>[number][] = [];
	for (const [unitOwnerItemId, costs] of descriptor.unitCostsByItemId) {
		const units = config.items[unitOwnerItemId]?.units;
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
			payerFactId: unitOwnerItemId,
			usableActionRuns:
				accounting === "single-payer-exact" ? Math.floor(units.amount / spendPerRun) : 0,
		});
	}
	const executionConstraint = readLineExecutionConstraintFn(descriptor.owner, descriptor.line);
	const minimumActionIntervalMs =
		descriptor.owner.type === "clock" && descriptor.owner.control === "automatic-only"
			? descriptor.owner.intervalMs
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
			...execution,
			...(unitUses.length === 0
				? {}
				: {
						unitUses,
					}),
			durationMs: descriptor.line.runtimeMs,
			id: readAcquisitionIdentityFn(
				"line-output",
				descriptor.owner.id,
				descriptor.line.id,
				occurrence.id,
				occurrence.factId,
			),
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

	for (const [unitOwnerItemId, costs] of descriptor.unitCostsByItemId) {
		const units = config.items[unitOwnerItemId]?.units;
		const spendPerRun = costs.reduce((total, { cost }) => total + cost, 0);
		if (units?.output === undefined || spendPerRun > units.amount) continue;
		if (units.amount % spendPerRun !== 0) continue;
		const runMultiplier = units.amount / spendPerRun;
		const unitOutputModel = readAcquisitionOutputOccurrencesFn(units.output);
		for (const occurrence of unitOutputModel.occurrences)
			routes.push({
				...execution,
				unitUses: unitUses.filter(({ payerFactId }) => payerFactId !== unitOwnerItemId),
				durationMs: descriptor.line.runtimeMs,
				id: readAcquisitionIdentityFn(
					"line-unit-depletion",
					descriptor.owner.id,
					descriptor.line.id,
					unitOwnerItemId,
					occurrence.id,
					occurrence.factId,
				),
				metadata: {
					unitOwnerItemId,
					kind: "line-unit-depletion",
					lineId: descriptor.line.id,
					lineTitle: descriptor.line.title,
					ownerItemId: descriptor.owner.id,
				},
				operation: {
					id: readAcquisitionIdentityFn("source", unitOwnerItemId, "units"),
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
					makeUnitDepletionRequirementsFn(descriptor.requirements, unitOwnerItemId),
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
		for (const line of readAuthoredItemLinesFn(item)) {
			const descriptor = readLineDescriptorFn(item, line);
			if (descriptor !== undefined) routes.push(...readLineRoutesFn(config, descriptor));
		}
	return routes;
};

const readMergeRoutesFn = (config: GameConfigSchema.Type, source: ItemSchema.Type) => {
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
					usage:
						merge.effect === "remove" || merge.effect === "replace"
							? "consume"
							: "one-time",
				},
			],
			anyOf: [],
		};
		const target = config.items[merge.target.itemId];
		const unitParticipants = [
			...(merge.action === "spend" && source.units !== undefined
				? [
						{
							units: source.units,
							itemId: source.id,
							requirementSource: "merge-source" as const,
							role: "source" as const,
						},
					]
				: []),
			...(merge.effect === "spend" && target?.units !== undefined
				? [
						{
							units: target.units,
							itemId: target.id,
							requirementSource: "merge-target" as const,
							role: "target" as const,
						},
					]
				: []),
		];
		const unitUses = unitParticipants.map(({ units, itemId }) => ({
			accounting: "single-payer-exact" as const,
			payerFactId: itemId,
			usableActionRuns: units.amount,
		}));
		const metadata = {
			kind: "merge-output",
			mergeIndex,
			sourceItemId: source.id,
			targetItemId: merge.target.itemId,
		} as const;
		const outputModel = readAcquisitionOutputOccurrencesFn(merge.output);
		const replacementOutputGroupId = "output:replacement";
		const operation = {
			id: readAcquisitionIdentityFn("source", source.id, "merge", mergeIndex),
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
				...(unitUses.length === 0
					? {}
					: {
							unitUses,
						}),
				durationMs: 0,
				id: readAcquisitionIdentityFn(
					"merge-replacement",
					source.id,
					merge.target.itemId,
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
					source.id,
					merge.target.itemId,
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
			if (participant.units.output === undefined) continue;
			const unitOutputModel = readAcquisitionOutputOccurrencesFn(participant.units.output);
			const depletionRequirements: AcquisitionRoute["requirements"] = {
				...requirements,
				allOf: requirements.allOf.map((requirement) =>
					requirement.factId === participant.itemId &&
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
						source.id,
						merge.target.itemId,
						mergeIndex,
						participant.role,
						output.id,
						output.factId,
					),
					metadata: {
						unitOwnerItemId: participant.itemId,
						kind: "merge-unit-depletion",
						mergeIndex,
						sourceItemId: source.id,
						targetItemId: merge.target.itemId,
					},
					operation: {
						id: readAcquisitionIdentityFn("source", participant.itemId, "units"),
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
	if (item.type !== "temporary" && item.type !== "clock") return [];
	if (item.durationMs === undefined) return [];
	const durationMs = item.durationMs;
	const kind = item.type === "temporary" ? "temporary-expiry" : "clock-expiry";
	const outputModel = readAcquisitionOutputOccurrencesFn(
		item.type === "temporary" ? item.output : item.onExpire,
	);
	return outputModel.occurrences.map(
		(output): AcquisitionRoute => ({
			...(item.type === "clock"
				? {
						executionConstraint:
							!item.enable && !item.rules.some(({ type }) => type === "enable")
								? ("unavailable" as const)
								: ("finite-owner-lifetime" as const),
					}
				: {}),
			durationMs,
			id: readAcquisitionIdentityFn(kind, item.id, output.id, output.factId),
			metadata: {
				itemId: item.id,
				kind,
			},
			operation: {
				id: readAcquisitionIdentityFn("source", item.id, "expiry"),
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
							factId: item.id,
							quantity: 1,
							source: item.type === "temporary" ? "temporary-item" : "expiring-item",
							usage: "consume",
						},
						...output.requirements.allOf,
					],
					anyOf: output.requirements.anyOf,
					unsupported: output.requirements.unsupported ?? [],
				},
				item.type === "clock"
					? readAcquisitionAvailabilityRequirementsFn({
							rules: item.rules,
							source: "line-condition",
						})
					: {
							allOf: [],
							anyOf: [],
						},
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
