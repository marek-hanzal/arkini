import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRequirement,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import { readPlannerActionId } from "~/editor/planner/readPlannerActionId";
import { readPlannerRequirementClauseId } from "~/editor/planner/readPlannerRequirementClauseId";
import { readPlannerRuntimeChargeCapacity } from "~/editor/planner/readPlannerRuntimeChargeCapacity";
import { readPlannerRuntimeQuantity } from "~/editor/planner/readPlannerRuntimeQuantity";
import type { PlannerSearchScope } from "~/editor/planner/PlannerSearchScope";
import { resolvePlannerRouteReachability } from "~/editor/planner/resolvePlannerRouteReachability";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export interface PlannerSearchPriority {
	readonly preferredHeadroomByDepth: ReadonlyArray<number>;
	readonly preferredProgressByDepth: ReadonlyArray<number>;
	readonly scopeProgress: number;
}

export interface PlannerSearchPriorityPlan {
	readonly chargeCapacityByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly depthByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly maximumSingleActionOutputByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly preferredRequirementByClauseId: ReadonlyMap<string, PlannerAcquisitionRequirement>;
	readonly renewalRouteByItemId: ReadonlyMap<IdSchema.Type, PlannerAcquisitionRoute>;
	readonly witnessRouteByItemId: ReadonlyMap<IdSchema.Type, PlannerAcquisitionRoute>;
}

const compareIds = (left: string, right: string) => left.localeCompare(right);

export interface PlannerActiveItemDemand {
	readonly bootstrapQuantity: number;
	readonly projectedQuantity: number;
	readonly quantity: number;
	readonly requiredCharges: number;
}

interface MutablePlannerActiveItemDemand {
	bootstrapQuantity: number;
	projectedQuantity: number;
	quantity: number;
	requiredCharges: number;
}

interface RequirementDemand {
	charges: number;
	consumed: number;
	retained: number;
}

interface RouteExpansionRuns {
	readonly bootstrap: number;
	readonly total: number;
}

const addRequirementDemand = (
	demandByItemId: Map<IdSchema.Type, RequirementDemand>,
	requirement: PlannerAcquisitionRequirement,
	runCount: number,
) => {
	const demand = demandByItemId.get(requirement.itemId) ?? {
		charges: 0,
		consumed: 0,
		retained: 0,
	};
	if (requirement.usage === "consume") demand.consumed += requirement.minimumQuantity * runCount;
	else demand.retained = Math.max(demand.retained, requirement.minimumQuantity);
	if (requirement.usage === "charge") demand.charges += (requirement.chargeCost ?? 0) * runCount;
	demandByItemId.set(requirement.itemId, demand);
};

const compareRequirements = (
	depthByItemId: ReadonlyMap<IdSchema.Type, number>,
	left: PlannerAcquisitionRequirement,
	right: PlannerAcquisitionRequirement,
) =>
	(depthByItemId.get(left.itemId) ?? Number.POSITIVE_INFINITY) -
		(depthByItemId.get(right.itemId) ?? Number.POSITIVE_INFINITY) ||
	compareIds(left.itemId, right.itemId);

const readChargeDepletionProgress = ({
	route,
	runtime,
}: {
	readonly route: Extract<
		PlannerAcquisitionRoute,
		{
			readonly kind: "line-charge-depletion";
		}
	>;
	readonly runtime: RuntimeSchema.Type;
}) => {
	let progress = 0;
	for (const item of runtime.items) {
		if (item.item.id !== route.chargedItemId) continue;
		const amount = item.item.charges?.amount;
		if (amount === undefined) continue;
		const remaining = item.remainingCharges ?? amount;
		const spentRatio = Math.min(1, Math.max(0, (amount - remaining) / amount));
		progress = Math.max(progress, spentRatio);
	}
	return progress;
};

const readClauseRequirement = ({
	clause,
	depthByItemId,
	preferred,
	runtime,
}: {
	readonly clause: ReadonlyArray<PlannerAcquisitionRequirement>;
	readonly depthByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly preferred?: PlannerAcquisitionRequirement;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const reachable = clause
		.filter((requirement) => depthByItemId.has(requirement.itemId))
		.sort((left, right) => compareRequirements(depthByItemId, left, right));
	return (
		reachable.find(
			(requirement) =>
				readPlannerRuntimeQuantity(runtime, requirement.itemId) >=
				requirement.minimumQuantity,
		) ??
		(preferred === undefined
			? undefined
			: reachable.find((requirement) => requirement === preferred)) ??
		reachable[0]
	);
};

const readMaximumSingleActionOutputByItemId = ({
	routes,
}: {
	readonly routes: ReadonlyArray<PlannerAcquisitionRoute>;
}) => {
	const statisticsByActionId = new Map<
		string,
		Map<
			IdSchema.Type,
			{
				deterministicQuantity: number;
				maximumStochasticQuantity: number;
			}
		>
	>();
	for (const route of routes) {
		const actionId = readPlannerActionId(route.action);
		const statisticsByItemId = statisticsByActionId.get(actionId) ?? new Map();
		const statistics = statisticsByItemId.get(route.output.itemId) ?? {
			deterministicQuantity: 0,
			maximumStochasticQuantity: 0,
		};
		if (route.output.stochastic)
			statistics.maximumStochasticQuantity = Math.max(
				statistics.maximumStochasticQuantity,
				route.output.maximumQuantity,
			);
		else statistics.deterministicQuantity += route.output.maximumQuantity;
		statisticsByItemId.set(route.output.itemId, statistics);
		statisticsByActionId.set(actionId, statisticsByItemId);
	}

	const maximumSingleActionOutputByItemId = new Map<IdSchema.Type, number>();
	for (const statisticsByItemId of statisticsByActionId.values())
		for (const [itemId, statistics] of statisticsByItemId)
			maximumSingleActionOutputByItemId.set(
				itemId,
				Math.max(
					maximumSingleActionOutputByItemId.get(itemId) ?? 0,
					statistics.deterministicQuantity + statistics.maximumStochasticQuantity,
				),
			);
	return maximumSingleActionOutputByItemId;
};

/** Creates the deterministic preferred witness used only to order forward-search states. */
export const readPlannerSearchPriorityPlan = ({
	graph,
	scope,
}: {
	readonly graph: PlannerAcquisitionGraph;
	readonly scope: PlannerSearchScope;
}): PlannerSearchPriorityPlan => {
	const scopeRouteIds = new Set(scope.routeIds);
	const scopeReachability = resolvePlannerRouteReachability({
		rootItemIds: graph.rootItemIds,
		routes: graph.routes.filter((route) => scopeRouteIds.has(route.id)),
	});
	return {
		chargeCapacityByItemId: graph.chargeCapacityByItemId,
		depthByItemId: scopeReachability.depthByItemId,
		maximumSingleActionOutputByItemId: readMaximumSingleActionOutputByItemId({
			routes: graph.routes.filter((route) => scopeRouteIds.has(route.id)),
		}),
		preferredRequirementByClauseId: scope.preferredRequirementByClauseId,
		renewalRouteByItemId: scope.preferredRenewalRouteByItemId,
		witnessRouteByItemId: scope.preferredRouteByItemId,
	};
};

const readAcquisitionRoute = (
	plan: PlannerSearchPriorityPlan,
	itemId: IdSchema.Type,
): PlannerAcquisitionRoute | undefined => {
	const witnessRoute = plan.witnessRouteByItemId.get(itemId);
	return witnessRoute?.output.itemId === itemId
		? witnessRoute
		: plan.renewalRouteByItemId.get(itemId);
};

const readRouteActionRunCount = (route: PlannerAcquisitionRoute, outputRunCount: number) =>
	route.kind === "line-charge-depletion"
		? outputRunCount * route.minimumRunsLowerBound
		: outputRunCount;

const readRouteRequirementDemand = ({
	plan,
	route,
	runCount,
	runtime,
}: {
	readonly plan: PlannerSearchPriorityPlan;
	readonly route: PlannerAcquisitionRoute;
	readonly runCount: number;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const demandByItemId = new Map<IdSchema.Type, RequirementDemand>();
	if (runCount <= 0) return demandByItemId;
	for (const requirement of route.requirements.allOf)
		addRequirementDemand(demandByItemId, requirement, runCount);
	for (const [clauseIndex, clause] of route.requirements.anyOf.entries()) {
		const requirement = readClauseRequirement({
			clause,
			depthByItemId: plan.depthByItemId,
			preferred: plan.preferredRequirementByClauseId.get(
				readPlannerRequirementClauseId(route.id, clauseIndex),
			),
			runtime,
		});
		if (requirement !== undefined) addRequirementDemand(demandByItemId, requirement, runCount);
	}
	return demandByItemId;
};

const readProjectedLifecycleQuantity = ({
	itemId,
	plan,
	requiredQuantity,
	renewedItemId,
	renewedQuantity,
}: {
	readonly itemId: IdSchema.Type;
	readonly plan: PlannerSearchPriorityPlan;
	readonly requiredQuantity: number;
	readonly renewedItemId: IdSchema.Type;
	readonly renewedQuantity: number;
}) => {
	const route = plan.witnessRouteByItemId.get(itemId);
	if (
		route?.kind !== "line-charge-depletion" ||
		route.chargedItemId !== renewedItemId ||
		route.output.stochastic
	)
		return 0;
	return Math.min(requiredQuantity, renewedQuantity * route.output.maximumQuantity);
};

/**
 * Reads the still-live preferred demand, including finite charge capacity and renewal bootstrap.
 *
 * Renewal prerequisites are activated before the final charge spend. A deterministic lifecycle
 * output produced by that spend is represented as projected quantity, so the scheduler prepares
 * the other prerequisites without trying to manufacture the lifecycle token prematurely.
 */
export const readPlannerActiveDemand = ({
	itemId,
	plan,
	quantity,
	runtime,
}: {
	readonly itemId: IdSchema.Type;
	readonly plan: PlannerSearchPriorityPlan;
	readonly quantity: number;
	readonly runtime: RuntimeSchema.Type;
}): ReadonlyMap<IdSchema.Type, PlannerActiveItemDemand> => {
	const demandByItemId = new Map<IdSchema.Type, MutablePlannerActiveItemDemand>();
	const pendingItemIds: IdSchema.Type[] = [];
	const pendingItemIdSet = new Set<IdSchema.Type>();
	const routeExpansionRunsByKey = new Map<string, RouteExpansionRuns>();
	const chargeDemandByExpansionKey = new Map<string, ReadonlyMap<IdSchema.Type, number>>();
	const normalPlannedQuantityByItemId = new Map<IdSchema.Type, number>();
	const renewalPlannedQuantityByItemId = new Map<IdSchema.Type, number>();
	const renewalQuantityByItemId = new Map<IdSchema.Type, number>();

	const queueItem = (candidateItemId: IdSchema.Type) => {
		if (pendingItemIdSet.has(candidateItemId)) return;
		pendingItemIdSet.add(candidateItemId);
		pendingItemIds.push(candidateItemId);
	};
	const addGoal = ({
		bootstrapQuantity = 0,
		candidateItemId,
		projectedQuantity = 0,
		requiredQuantity,
	}: {
		readonly bootstrapQuantity?: number;
		readonly candidateItemId: IdSchema.Type;
		readonly projectedQuantity?: number;
		readonly requiredQuantity: number;
	}) => {
		const current = demandByItemId.get(candidateItemId) ?? {
			bootstrapQuantity: 0,
			projectedQuantity: 0,
			quantity: 0,
			requiredCharges: 0,
		};
		const nextQuantity = Math.max(current.quantity, requiredQuantity);
		const nextBootstrapQuantity = Math.min(
			nextQuantity,
			Math.max(current.bootstrapQuantity, bootstrapQuantity),
		);
		const nextProjectedQuantity = Math.max(current.projectedQuantity, projectedQuantity);
		if (
			nextQuantity === current.quantity &&
			nextBootstrapQuantity === current.bootstrapQuantity &&
			nextProjectedQuantity === current.projectedQuantity
		)
			return;
		demandByItemId.set(candidateItemId, {
			...current,
			bootstrapQuantity: nextBootstrapQuantity,
			projectedQuantity: nextProjectedQuantity,
			quantity: nextQuantity,
		});
		queueItem(candidateItemId);
	};

	const expandRoute = ({
		bootstrapRunCount,
		expansionKey,
		renewedItemId,
		renewedQuantity = 0,
		route,
		runCount,
	}: {
		readonly bootstrapRunCount: number;
		readonly expansionKey: string;
		readonly renewedItemId?: IdSchema.Type;
		readonly renewedQuantity?: number;
		readonly route: PlannerAcquisitionRoute;
		readonly runCount: number;
	}) => {
		const previous = routeExpansionRunsByKey.get(expansionKey);
		if (
			previous !== undefined &&
			previous.total >= runCount &&
			previous.bootstrap >= bootstrapRunCount
		)
			return;
		routeExpansionRunsByKey.set(expansionKey, {
			bootstrap: Math.max(previous?.bootstrap ?? 0, bootstrapRunCount),
			total: Math.max(previous?.total ?? 0, runCount),
		});
		const totalDemand = readRouteRequirementDemand({
			plan,
			route,
			runCount,
			runtime,
		});
		const bootstrapDemand = readRouteRequirementDemand({
			plan,
			route,
			runCount: bootstrapRunCount,
			runtime,
		});
		const chargeDemandByItemId = new Map<IdSchema.Type, number>();
		for (const [requirementItemId, demand] of totalDemand) {
			const requiredQuantity = demand.consumed + demand.retained;
			const bootstrap = bootstrapDemand.get(requirementItemId);
			const bootstrapQuantity = (bootstrap?.consumed ?? 0) + (bootstrap?.retained ?? 0);
			const projectedQuantity =
				renewedItemId === undefined
					? 0
					: readProjectedLifecycleQuantity({
							itemId: requirementItemId,
							plan,
							renewedItemId,
							renewedQuantity,
							requiredQuantity,
						});
			addGoal({
				bootstrapQuantity,
				candidateItemId: requirementItemId,
				projectedQuantity,
				requiredQuantity,
			});
			if (demand.charges > 0) chargeDemandByItemId.set(requirementItemId, demand.charges);
		}
		chargeDemandByExpansionKey.set(expansionKey, chargeDemandByItemId);
	};

	addGoal({
		candidateItemId: itemId,
		requiredQuantity: quantity,
	});

	const maximumRenewalRounds = Math.max(
		64,
		(plan.witnessRouteByItemId.size + plan.renewalRouteByItemId.size) * 4,
	);
	for (let renewalRound = 0; renewalRound < maximumRenewalRounds; renewalRound += 1) {
		while (pendingItemIds.length > 0) {
			const candidateItemId = pendingItemIds.shift();
			if (candidateItemId === undefined) continue;
			pendingItemIdSet.delete(candidateItemId);
			const demand = demandByItemId.get(candidateItemId);
			if (demand === undefined) continue;
			const route = readAcquisitionRoute(plan, candidateItemId);
			if (route === undefined || route.output.maximumQuantity <= 0) continue;
			const availableQuantity =
				readPlannerRuntimeQuantity(runtime, candidateItemId) + demand.projectedQuantity;
			const missingQuantity = Math.max(0, demand.quantity - availableQuantity);
			const missingBootstrapQuantity = Math.max(
				0,
				demand.bootstrapQuantity - availableQuantity,
			);
			const outputRunCount = Math.ceil(missingQuantity / route.output.maximumQuantity);
			const bootstrapOutputRunCount = Math.min(
				outputRunCount,
				Math.ceil(missingBootstrapQuantity / route.output.maximumQuantity),
			);
			const actionRunCount = readRouteActionRunCount(route, outputRunCount);
			const bootstrapActionRunCount = readRouteActionRunCount(route, bootstrapOutputRunCount);
			normalPlannedQuantityByItemId.set(
				candidateItemId,
				outputRunCount * route.output.maximumQuantity,
			);
			if (actionRunCount > 0)
				expandRoute({
					bootstrapRunCount: bootstrapActionRunCount,
					expansionKey: `normal:${candidateItemId}`,
					route,
					runCount: actionRunCount,
				});
		}

		const requiredChargesByItemId = new Map<IdSchema.Type, number>();
		for (const chargeDemand of chargeDemandByExpansionKey.values())
			for (const [chargedItemId, charges] of chargeDemand)
				requiredChargesByItemId.set(
					chargedItemId,
					(requiredChargesByItemId.get(chargedItemId) ?? 0) + charges,
				);

		let renewalExpanded = false;
		for (const [chargedItemId, requiredCharges] of requiredChargesByItemId) {
			const demand = demandByItemId.get(chargedItemId);
			if (demand !== undefined) demand.requiredCharges = requiredCharges;
			const fullCapacity = plan.chargeCapacityByItemId.get(chargedItemId);
			if (fullCapacity === undefined || fullCapacity <= 0) continue;
			const route = readAcquisitionRoute(plan, chargedItemId);
			if (route === undefined || route.output.maximumQuantity <= 0) continue;
			const currentCapacity = readPlannerRuntimeChargeCapacity(runtime, chargedItemId);
			const normalPlannedCapacity =
				(normalPlannedQuantityByItemId.get(chargedItemId) ?? 0) * fullCapacity;
			const projectedCapacity = (demand?.projectedQuantity ?? 0) * fullCapacity;
			const alreadyPlannedRenewalCapacity =
				(renewalPlannedQuantityByItemId.get(chargedItemId) ?? 0) * fullCapacity;
			const availableCapacity =
				currentCapacity +
				normalPlannedCapacity +
				projectedCapacity +
				alreadyPlannedRenewalCapacity;
			if (requiredCharges <= availableCapacity) continue;
			const additionalRenewalQuantity = Math.ceil(
				(requiredCharges - availableCapacity) / fullCapacity,
			);
			const nextRenewalQuantity =
				(renewalQuantityByItemId.get(chargedItemId) ?? 0) + additionalRenewalQuantity;
			renewalQuantityByItemId.set(chargedItemId, nextRenewalQuantity);
			const renewalOutputRunCount = Math.ceil(
				nextRenewalQuantity / route.output.maximumQuantity,
			);
			const renewalActionRunCount = readRouteActionRunCount(route, renewalOutputRunCount);
			const plannedRenewalQuantity = renewalOutputRunCount * route.output.maximumQuantity;
			renewalPlannedQuantityByItemId.set(chargedItemId, plannedRenewalQuantity);
			expandRoute({
				bootstrapRunCount: renewalActionRunCount,
				expansionKey: `renewal:${chargedItemId}`,
				renewedItemId: chargedItemId,
				renewedQuantity: nextRenewalQuantity,
				route,
				runCount: renewalActionRunCount,
			});
			renewalExpanded = true;
		}
		if (!renewalExpanded && pendingItemIds.length === 0) break;
	}

	return new Map(
		[
			...demandByItemId,
		].map(([candidateItemId, demand]) => [
			candidateItemId,
			{
				bootstrapQuantity: demand.bootstrapQuantity,
				projectedQuantity: demand.projectedQuantity,
				quantity: demand.quantity,
				requiredCharges: demand.requiredCharges,
			} satisfies PlannerActiveItemDemand,
		]),
	);
};

/**
 * Reads lexicographic progress toward the preferred witness plus a broad scope tie-breaker.
 *
 * Partial charge spend counts as progress toward a depletion output. Without it, a shallower fuel
 * producer could outrank the real spender forever once enough consumables already exist.
 */
export const readPlannerSearchPriority = ({
	itemId,
	plan,
	quantity,
	runtime,
	scope,
}: {
	readonly itemId: IdSchema.Type;
	readonly plan: PlannerSearchPriorityPlan;
	readonly quantity: number;
	readonly runtime: RuntimeSchema.Type;
	readonly scope: PlannerSearchScope;
}): PlannerSearchPriority => {
	const preferredHeadroomByDepth: number[] = [];
	const preferredProgressByDepth: number[] = [];
	for (const [candidateItemId, demand] of readPlannerActiveDemand({
		itemId,
		plan,
		quantity,
		runtime,
	})) {
		if (demand.quantity <= 0) continue;
		const availableQuantity = Math.min(
			readPlannerRuntimeQuantity(runtime, candidateItemId) + demand.projectedQuantity,
			demand.quantity,
		);
		const witnessRoute = plan.witnessRouteByItemId.get(candidateItemId);
		const route =
			witnessRoute?.output.itemId === candidateItemId
				? witnessRoute
				: plan.renewalRouteByItemId.get(candidateItemId);
		const lifecycleQuantity =
			availableQuantity < demand.quantity && route?.kind === "line-charge-depletion"
				? Math.min(
						demand.quantity - availableQuantity,
						route.output.maximumQuantity *
							readChargeDepletionProgress({
								route,
								runtime,
							}),
					)
				: 0;
		const progress = (availableQuantity + lifecycleQuantity) / demand.quantity;
		const depth = plan.depthByItemId.get(candidateItemId) ?? 0;
		preferredProgressByDepth[depth] = (preferredProgressByDepth[depth] ?? 0) + progress;

		const maximumSingleActionOutput =
			plan.maximumSingleActionOutputByItemId.get(candidateItemId) ?? 0;
		const headroomCapacity = Math.max(0, maximumSingleActionOutput - demand.quantity);
		if (headroomCapacity > 0) {
			const headroom =
				Math.min(
					headroomCapacity,
					Math.max(
						0,
						readPlannerRuntimeQuantity(runtime, candidateItemId) - demand.quantity,
					),
				) / headroomCapacity;
			preferredHeadroomByDepth[depth] = (preferredHeadroomByDepth[depth] ?? 0) + headroom;
		}
	}

	let scopeProgress = 0;
	for (const candidateItemId of scope.itemIds) {
		if (readPlannerRuntimeQuantity(runtime, candidateItemId) <= 0) continue;
		scopeProgress += plan.depthByItemId.get(candidateItemId) ?? 0;
	}
	return {
		preferredHeadroomByDepth,
		preferredProgressByDepth,
		scopeProgress,
	};
};

/**
 * Sorts exact preferred progress first, then one-action surplus and broad target-scope progress.
 *
 * The surplus tier is deliberately capped at the largest authored result of one action. It helps
 * a width-one optimistic beam retain a useful stochastic companion without rewarding unbounded
 * stockpiling once the currently visible demand is already satisfied.
 */
export const comparePlannerSearchPriority = (
	left: PlannerSearchPriority,
	right: PlannerSearchPriority,
) => {
	const maximumDepth = Math.max(
		left.preferredProgressByDepth.length,
		right.preferredProgressByDepth.length,
	);
	for (let depth = maximumDepth - 1; depth >= 0; depth -= 1) {
		const difference =
			(right.preferredProgressByDepth[depth] ?? 0) -
			(left.preferredProgressByDepth[depth] ?? 0);
		if (difference !== 0) return difference;
	}
	for (let depth = maximumDepth - 1; depth >= 0; depth -= 1) {
		const difference =
			(right.preferredHeadroomByDepth[depth] ?? 0) -
			(left.preferredHeadroomByDepth[depth] ?? 0);
		if (difference !== 0) return difference;
	}
	return right.scopeProgress - left.scopeProgress;
};
