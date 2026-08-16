import { Effect } from "effect";

import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import { isPlannerAcquisitionRouteReadyFx } from "~/editor/planner/isPlannerAcquisitionRouteReadyFx";
import { readPlannerRuntimeQuantityFx } from "~/editor/planner/readPlannerRuntimeQuantityFx";
import type {
	PlannerActiveItemDemand,
	PlannerSearchPriorityPlan,
} from "~/editor/planner/readPlannerSearchPriorityFx";
import type { PlannerSearchAction, PlannerSearchScope } from "~/editor/planner/PlannerSearchScope";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export interface PlannerSearchCandidateGroup {
	readonly actions: ReadonlyArray<PlannerSearchAction>;
	readonly outputItemId: IdSchema.Type;
}

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
export const readPlannerSearchCandidateGroupsFx = Effect.fn("readPlannerSearchCandidateGroupsFx")(
	({
		activeDemand,
		graph,
		plan,
		runtime,
		scope,
	}: {
		readonly activeDemand: ReadonlyMap<IdSchema.Type, PlannerActiveItemDemand>;
		readonly graph: PlannerAcquisitionGraph;
		readonly plan: PlannerSearchPriorityPlan;
		readonly runtime: RuntimeSchema.Type;
		readonly scope: PlannerSearchScope;
	}) =>
		Effect.gen(function* () {
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
					const availableQuantity =
						(yield* readPlannerRuntimeQuantityFx(runtime, outputItemId)) +
						(demand?.projectedQuantity ?? 0);
					if (demand === undefined || availableQuantity >= demand.quantity) continue;
					const routes = readActionRoutesForOutput(action, outputItemId, routeById);
					if (routes.length === 0) continue;
					const group = candidatesByOutputItemId.get(outputItemId) ?? {
						actions: [],
						readyActions: [],
					};
					group.actions.push(action);
					let ready = false;
					for (const route of routes)
						if (yield* isPlannerAcquisitionRouteReadyFx(route, runtime)) {
							ready = true;
							break;
						}
					if (ready) group.readyActions.push(action);
					candidatesByOutputItemId.set(outputItemId, group);
				}
			}

			const groups: Array<{
				readonly actions: ReadonlyArray<PlannerSearchAction>;
				readonly bootstrap: boolean;
				readonly outputItemId: IdSchema.Type;
				readonly ready: boolean;
			}> = [];
			for (const [outputItemId, group] of candidatesByOutputItemId) {
				const demand = activeDemand.get(outputItemId);
				const availableQuantity =
					(yield* readPlannerRuntimeQuantityFx(runtime, outputItemId)) +
					(demand?.projectedQuantity ?? 0);
				groups.push({
					actions: group.readyActions.length > 0 ? group.readyActions : group.actions,
					bootstrap: availableQuantity < (demand?.bootstrapQuantity ?? 0),
					outputItemId,
					ready: group.readyActions.length > 0,
				});
			}
			const hasReadyGroup = groups.some(({ ready }) => ready);
			return groups
				.filter(({ ready }) => !hasReadyGroup || ready)
				.sort(
					(left, right) =>
						Number(right.bootstrap) - Number(left.bootstrap) ||
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
		}),
);
