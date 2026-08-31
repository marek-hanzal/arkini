import { Order } from "effect";

import { groupEstimateRequirementsFn } from "~/estimate/fn/groupEstimateRequirementsFn";
import type { EstimateTopology } from "~/estimate/fn/createEstimateTopologyFn";
import { readEstimateMissingQuantityFn } from "~/estimate/fn/readEstimateMissingQuantityFn";
import {
	readEstimateScalarExpectedRunsFn,
	type EstimateExpectedRunsResult,
} from "~/estimate/fn/readEstimateExpectedRunsFn";
import { itemEstimateMaximumQuantity } from "~/estimate/schema/ItemEstimateQuantitySchema";
import type {
	AcquisitionQuantityProbability,
	AcquisitionRequirement,
	AcquisitionRoute,
} from "~/flow/type/AcquisitionGraph";

const epsilon = 1e-9;

export interface EstimateRoutePolicy {
	readonly completeFactsByBlockedKey: ReadonlyMap<string, ReadonlySet<string>>;
	readonly topology: EstimateTopology;
	readonly unitCost: ReadonlyMap<string, number>;
}

interface EstimateRouteCostContext {
	readonly quantityCostMemo: Map<string, number>;
	readonly scalarRunsByDistribution: Map<
		ReadonlyArray<AcquisitionQuantityProbability>,
		Map<number, EstimateExpectedRunsResult>
	>;
}

export interface EstimateRouteChoicePoint {
	readonly key: string;
	readonly options: ReadonlyArray<string>;
	readonly selected: string;
}

const requirementChoiceKeyFn = (routeId: string, clauseIndex: number) =>
	`requirement\u0000${routeId}\u0000${clauseIndex}`;

const readRequirementQuantityFn = (requirement: AcquisitionRequirement, actionRuns: number) =>
	requirement.quantity * (requirement.usage === "consume" ? actionRuns : 1);

const readScalarExpectedRunsFn = (
	context: EstimateRouteCostContext,
	distribution: ReadonlyArray<AcquisitionQuantityProbability>,
	quantity: number,
) => {
	if (quantity > itemEstimateMaximumQuantity)
		return {
			status: "state-space-unsupported",
		} satisfies EstimateExpectedRunsResult;
	const cachedByQuantity = context.scalarRunsByDistribution.get(distribution);
	const cached = cachedByQuantity?.get(quantity);
	if (cached !== undefined) return cached;
	const result = readEstimateScalarExpectedRunsFn(distribution, quantity);
	const byQuantity = cachedByQuantity ?? new Map<number, EstimateExpectedRunsResult>();
	byQuantity.set(quantity, result);
	if (cachedByQuantity === undefined)
		context.scalarRunsByDistribution.set(distribution, byQuantity);
	return result;
};

const compileCompleteFactsFn = (
	topology: EstimateTopology,
	blockedFactIds: ReadonlySet<string>,
) => {
	const complete = new Set(topology.roots.keys());
	let pending = [
		...topology.routesByFact.values(),
	]
		.flatMap((routes) => routes)
		.filter(
			(route) =>
				!blockedFactIds.has(route.output.factId) && !topology.unsupportedRoutes.has(route),
		);
	for (let iteration = 0; iteration < topology.factCount; iteration += 1) {
		let changed = false;
		const nextPending: AcquisitionRoute[] = [];
		for (const route of pending) {
			const requirements = topology.requirementsByRoute.get(route);
			if (
				requirements === undefined ||
				requirements.allOf.some(({ factId }) => !complete.has(factId)) ||
				requirements.anyOf.some(
					(clause) => !clause.some(({ factId }) => complete.has(factId)),
				)
			)
				nextPending.push(route);
			else if (!complete.has(route.output.factId)) {
				complete.add(route.output.factId);
				changed = true;
			}
		}
		if (!changed) break;
		pending = nextPending;
	}
	return complete;
};

const readCompleteFactsFn = (policy: EstimateRoutePolicy, blockedFactIds: ReadonlySet<string>) => {
	const key = [
		...blockedFactIds,
	]
		.sort(Order.String)
		.join("\u0000");
	return (
		policy.completeFactsByBlockedKey.get(key) ??
		compileCompleteFactsFn(policy.topology, blockedFactIds)
	);
};

const isCompleteRouteFn = (
	policy: EstimateRoutePolicy,
	route: AcquisitionRoute,
	blockedFactIds: ReadonlySet<string>,
) => {
	if (policy.topology.unsupportedRoutes.has(route)) return false;
	const requirements = policy.topology.requirementsByRoute.get(route);
	if (requirements === undefined) return false;
	const satisfiesFn = (complete: ReadonlySet<string>) =>
		requirements.allOf.every(({ factId }) => complete.has(factId)) &&
		requirements.anyOf.every((clause) => clause.some(({ factId }) => complete.has(factId)));
	const complete = readCompleteFactsFn(policy, blockedFactIds);
	if (!satisfiesFn(complete)) return false;
	const outputComponent =
		policy.topology.componentByFact.get(route.output.factId) ?? route.output.factId;
	const mayReenterOutputComponent =
		requirements.allOf.some(
			({ factId }) =>
				(policy.topology.componentByFact.get(factId) ?? factId) === outputComponent,
		) ||
		requirements.anyOf.some((clause) =>
			clause
				.filter(({ factId }) => complete.has(factId))
				.every(
					({ factId }) =>
						(policy.topology.componentByFact.get(factId) ?? factId) === outputComponent,
				),
		);
	return (
		!mayReenterOutputComponent ||
		satisfiesFn(
			readCompleteFactsFn(
				policy,
				new Set([
					...blockedFactIds,
					route.output.factId,
				]),
			),
		)
	);
};

const createRouteCostContextFn = (): EstimateRouteCostContext => ({
	quantityCostMemo: new Map(),
	scalarRunsByDistribution: new Map(),
});

const selectRouteRequirementsFn = (
	policy: EstimateRoutePolicy,
	route: AcquisitionRoute,
	actionRuns: number,
	activeComponentId: string,
	blockedFactIds: ReadonlySet<string>,
	context: EstimateRouteCostContext,
	overrides: ReadonlyMap<string, string>,
) => {
	const routeRequirements = policy.topology.requirementsByRoute.get(route);
	if (routeRequirements === undefined) return undefined;
	const choices: EstimateRouteChoicePoint[] = [];
	const requirements = [
		...routeRequirements.allOf,
	];
	for (const [clauseIndex, clause] of routeRequirements.anyOf.entries()) {
		const options = clause
			.map((requirement, index) => {
				const reentersIncompleteComponent =
					(policy.topology.componentByFact.get(requirement.factId) ??
						requirement.factId) === activeComponentId &&
					!readCompleteFactsFn(
						policy,
						new Set([
							...blockedFactIds,
							route.output.factId,
						]),
					).has(requirement.factId);
				return {
					cost: reentersIncompleteComponent
						? Number.POSITIVE_INFINITY
						: readFactCostFn(
								policy,
								requirement.factId,
								readRequirementQuantityFn(requirement, actionRuns),
								activeComponentId,
								blockedFactIds,
								context,
							),
					index,
					requirement,
				};
			})
			.filter(({ cost }) => Number.isFinite(cost))
			.sort(
				(left, right) =>
					left.cost - right.cost ||
					Order.String(left.requirement.factId, right.requirement.factId) ||
					left.index - right.index,
			);
		const key = requirementChoiceKeyFn(route.id, clauseIndex);
		const override = overrides.get(key);
		const selected =
			override === undefined
				? options[0]
				: options.find(({ index }) => String(index) === override);
		const selectedValue = selected === undefined ? override : String(selected.index);
		const choiceOptions = options.map(({ index }) => String(index));
		if (
			selectedValue !== undefined &&
			choiceOptions.length > 0 &&
			(choiceOptions.length > 1 || choiceOptions[0] !== selectedValue)
		)
			choices.push({
				key,
				options: choiceOptions,
				selected: selectedValue,
			});
		if (selected === undefined) return undefined;
		requirements.push(selected.requirement);
	}
	return {
		choices,
		groups: groupEstimateRequirementsFn(requirements, actionRuns),
	};
};

export const readEstimateRouteRequirementsFn = (
	policy: EstimateRoutePolicy,
	route: AcquisitionRoute,
	actionRuns: number,
	overrides: ReadonlyMap<string, string>,
) =>
	selectRouteRequirementsFn(
		policy,
		route,
		actionRuns,
		policy.topology.componentByFact.get(route.output.factId) ?? route.output.factId,
		new Set(),
		createRouteCostContextFn(),
		overrides,
	);

const readRouteCostFn = (
	policy: EstimateRoutePolicy,
	route: AcquisitionRoute,
	quantity: number,
	activeComponentId = policy.topology.componentByFact.get(route.output.factId) ??
		route.output.factId,
	blockedFactIds: ReadonlySet<string> = new Set(),
	context = createRouteCostContextFn(),
) => {
	if (!isCompleteRouteFn(policy, route, blockedFactIds)) return Number.POSITIVE_INFINITY;
	const expected = readScalarExpectedRunsFn(context, route.output.quantityDistribution, quantity);
	if (expected.status === "state-space-unsupported" || !Number.isFinite(expected.runs))
		return Number.POSITIVE_INFINITY;
	const outputRuns = expected.runs;
	const actionRuns = outputRuns * route.runMultiplier;
	const selection = selectRouteRequirementsFn(
		policy,
		route,
		actionRuns,
		activeComponentId,
		blockedFactIds,
		context,
		new Map(),
	);
	if (selection === undefined) return Number.POSITIVE_INFINITY;
	let dependencyCost = 0;
	for (const group of selection.groups) {
		const groupCost = readFactCostFn(
			policy,
			group.factId,
			group.consumed + Math.max(group.oneTime, group.ongoing),
			activeComponentId,
			blockedFactIds,
			context,
		);
		if (!Number.isFinite(groupCost)) return groupCost;
		dependencyCost = Math.max(dependencyCost, groupCost);
	}
	return route.durationMs * actionRuns + dependencyCost;
};

function readFactCostFn(
	policy: EstimateRoutePolicy,
	factId: string,
	quantity: number,
	activeComponentId: string,
	blockedFactIds: ReadonlySet<string>,
	context: EstimateRouteCostContext,
): number {
	const missing = readEstimateMissingQuantityFn(policy.topology, factId, quantity);
	if (missing <= epsilon) return 0;
	if (blockedFactIds.has(factId)) return Number.POSITIVE_INFINITY;
	const componentId = policy.topology.componentByFact.get(factId) ?? factId;
	if (componentId === activeComponentId)
		return (policy.unitCost.get(factId) ?? Number.POSITIVE_INFINITY) * missing;
	const normalized = Math.round(missing * 1e9) / 1e9;
	const blockedTop = blockedFactIds.values().next().value ?? "";
	const key = `${factId}\u0000${normalized}\u0000${activeComponentId}\u0000${blockedTop}`;
	const memoized = context.quantityCostMemo.get(key);
	if (memoized !== undefined) return memoized;
	const cost = Math.min(
		...(policy.topology.routesByFact.get(factId) ?? [])
			.filter((route) => isCompleteRouteFn(policy, route, blockedFactIds))
			.map((route) =>
				readRouteCostFn(policy, route, missing, componentId, blockedFactIds, context),
			),
	);
	context.quantityCostMemo.set(key, cost);
	return cost;
}

export const readEstimateRouteOptionsFn = (
	policy: EstimateRoutePolicy,
	factId: string,
	quantity: number,
) => {
	const missing = readEstimateMissingQuantityFn(policy.topology, factId, quantity);
	const context = createRouteCostContextFn();
	return (policy.topology.routesByFact.get(factId) ?? [])
		.map((route) => ({
			cost: readRouteCostFn(
				policy,
				route,
				missing,
				policy.topology.componentByFact.get(factId) ?? factId,
				new Set(),
				context,
			),
			route,
		}))
		.filter(({ cost }) => Number.isFinite(cost))
		.sort(
			(left, right) => left.cost - right.cost || Order.String(left.route.id, right.route.id),
		)
		.map(({ route }) => route);
};

/** Creates call-local scratch for exact quantity-aware route ordering. */
export const createEstimateRoutePolicyFn = (topology: EstimateTopology): EstimateRoutePolicy => {
	const completeFactsByBlockedKey = new Map<string, ReadonlySet<string>>();
	for (const blockedFactIds of [
		new Set<string>(),
		...[
			...topology.factIds,
		].map(
			(factId) =>
				new Set([
					factId,
				]),
		),
	])
		completeFactsByBlockedKey.set(
			[
				...blockedFactIds,
			]
				.sort(Order.String)
				.join("\u0000"),
			compileCompleteFactsFn(topology, blockedFactIds),
		);
	const unitCost = new Map<string, number>();
	const policy: EstimateRoutePolicy = {
		completeFactsByBlockedKey,
		topology,
		unitCost,
	};
	const context = createRouteCostContextFn();
	for (const factId of topology.roots.keys()) unitCost.set(factId, 0);
	for (let iteration = 0; iteration < topology.factCount; iteration += 1) {
		let changed = false;
		for (const routes of topology.routesByFact.values())
			for (const route of routes) {
				if (topology.unsupportedRoutes.has(route)) continue;
				const expected = readScalarExpectedRunsFn(
					context,
					route.output.quantityDistribution,
					1,
				);
				if (
					expected.status === "state-space-unsupported" ||
					!Number.isFinite(expected.runs)
				)
					continue;
				const outputRuns = expected.runs;
				const actionRuns = outputRuns * route.runMultiplier;
				let dependencyCost = 0;
				const requirements = topology.requirementsByRoute.get(route);
				if (requirements === undefined) continue;
				for (const requirement of requirements.allOf) {
					const requirementCost = unitCost.get(requirement.factId);
					if (requirementCost === undefined) {
						dependencyCost = Number.POSITIVE_INFINITY;
						break;
					}
					dependencyCost = Math.max(
						dependencyCost,
						requirementCost * readRequirementQuantityFn(requirement, actionRuns),
					);
				}
				for (const clause of requirements.anyOf)
					dependencyCost = Math.max(
						dependencyCost,
						Math.min(
							...clause.map((requirement) => {
								const requirementCost = unitCost.get(requirement.factId);
								return requirementCost === undefined
									? Number.POSITIVE_INFINITY
									: requirementCost *
											readRequirementQuantityFn(requirement, actionRuns);
							}),
						),
					);
				const cost = route.durationMs * actionRuns + dependencyCost;
				const current = unitCost.get(route.output.factId);
				if (Number.isFinite(cost) && (current === undefined || cost < current - epsilon)) {
					unitCost.set(route.output.factId, cost);
					changed = true;
				}
			}
		if (!changed) break;
	}
	return policy;
};
