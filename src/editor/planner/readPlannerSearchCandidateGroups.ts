import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRequirement,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import { readPlannerRuntimeQuantity } from "~/editor/planner/readPlannerRuntimeQuantity";
import {
	readPlannerActiveDemand,
	type PlannerSearchPriorityPlan,
} from "~/editor/planner/readPlannerSearchPriority";
import type { PlannerSearchAction, PlannerSearchScope } from "~/editor/planner/PlannerSearchScope";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export interface PlannerSearchCandidateGroup {
	readonly actions: ReadonlyArray<PlannerSearchAction>;
	readonly outputItemId: IdSchema.Type;
}

interface RequirementDemand {
	consumed: number;
	retained: number;
}

const addRequirement = (
	demandByItemId: Map<IdSchema.Type, RequirementDemand>,
	requirement: PlannerAcquisitionRequirement,
) => {
	const demand = demandByItemId.get(requirement.itemId) ?? {
		consumed: 0,
		retained: 0,
	};
	if (requirement.usage === "consume") demand.consumed += requirement.minimumQuantity;
	else demand.retained = Math.max(demand.retained, requirement.minimumQuantity);
	demandByItemId.set(requirement.itemId, demand);
};

const isRouteReady = (route: PlannerAcquisitionRoute, runtime: RuntimeSchema.Type) => {
	const demandByItemId = new Map<IdSchema.Type, RequirementDemand>();
	for (const requirement of route.requirements.allOf) addRequirement(demandByItemId, requirement);
	for (const [itemId, demand] of demandByItemId)
		if (readPlannerRuntimeQuantity(runtime, itemId) < demand.consumed + demand.retained)
			return false;
	return route.requirements.anyOf.every((clause) =>
		clause.some(
			(requirement) =>
				readPlannerRuntimeQuantity(runtime, requirement.itemId) >=
				requirement.minimumQuantity,
		),
	);
};

const readActionRoutesForOutput = (
	action: PlannerSearchAction,
	outputItemId: IdSchema.Type,
	routeById: ReadonlyMap<string, PlannerAcquisitionRoute>,
) =>
	action.routeIds.flatMap((routeId) => {
		const route = routeById.get(routeId);
		return route?.output.itemId === outputItemId
			? [
					route,
				]
			: [];
	});

/**
 * Orders active output goals and groups all equal-goal authored alternatives together.
 *
 * Only one goal group needs to branch at a time. This avoids exploring every permutation of
 * independent prerequisites while retaining backtracking between alternative routes for the same
 * next item. When static requirements cannot identify a ready group, engine remains the judge and
 * the unresolved groups are returned in the same deterministic order.
 */
export const readPlannerSearchCandidateGroups = ({
	graph,
	itemId,
	plan,
	quantity,
	runtime,
	scope,
}: {
	readonly graph: PlannerAcquisitionGraph;
	readonly itemId: IdSchema.Type;
	readonly plan: PlannerSearchPriorityPlan;
	readonly quantity: number;
	readonly runtime: RuntimeSchema.Type;
	readonly scope: PlannerSearchScope;
}): ReadonlyArray<PlannerSearchCandidateGroup> => {
	const activeDemand = readPlannerActiveDemand({
		itemId,
		plan,
		quantity,
		runtime,
	});
	const demandOrder = new Map(
		[
			...activeDemand.keys(),
		].map((candidateItemId, index) => [
			candidateItemId,
			index,
		]),
	);
	const routeById = new Map(
		graph.routes.map((route) => [
			route.id,
			route,
		]),
	);
	const candidatesByOutputItemId = new Map<
		IdSchema.Type,
		{
			readonly actions: PlannerSearchAction[];
			readonly readyActions: PlannerSearchAction[];
		}
	>();

	for (const action of scope.actions) {
		for (const outputItemId of action.outputItemIds) {
			const demand = activeDemand.get(outputItemId);
			if (demand === undefined || readPlannerRuntimeQuantity(runtime, outputItemId) >= demand)
				continue;
			const routes = readActionRoutesForOutput(action, outputItemId, routeById);
			if (routes.length === 0) continue;
			const group = candidatesByOutputItemId.get(outputItemId) ?? {
				actions: [],
				readyActions: [],
			};
			group.actions.push(action);
			if (routes.some((route) => isRouteReady(route, runtime)))
				group.readyActions.push(action);
			candidatesByOutputItemId.set(outputItemId, group);
		}
	}

	const groups = [
		...candidatesByOutputItemId,
	].map(([outputItemId, group]) => ({
		actions: group.readyActions.length > 0 ? group.readyActions : group.actions,
		outputItemId,
		ready: group.readyActions.length > 0,
	}));
	const hasReadyGroup = groups.some(({ ready }) => ready);
	return groups
		.filter(({ ready }) => !hasReadyGroup || ready)
		.sort(
			(left, right) =>
				(plan.depthByItemId.get(right.outputItemId) ?? 0) -
					(plan.depthByItemId.get(left.outputItemId) ?? 0) ||
				(demandOrder.get(left.outputItemId) ?? Number.POSITIVE_INFINITY) -
					(demandOrder.get(right.outputItemId) ?? Number.POSITIVE_INFINITY) ||
				left.outputItemId.localeCompare(right.outputItemId),
		)
		.map(({ actions, outputItemId }) => ({
			actions: [
				...new Map(
					actions.map((action) => [
						action.id,
						action,
					]),
				).values(),
			],
			outputItemId,
		}));
};
