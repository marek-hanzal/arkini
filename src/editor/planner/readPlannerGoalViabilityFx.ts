import { Effect } from "effect";

import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import { readPlannerItemGoalStatusFx } from "~/editor/planner/readPlannerItemGoalStatusFx";
import { readPlannerStructuralReachabilityFx } from "~/editor/planner/readPlannerStructuralReachabilityFx";
import { resolvePlannerRouteReachabilityFx } from "~/editor/planner/resolvePlannerRouteReachabilityFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

const readRuntimeRootItemIds = (runtime: RuntimeSchema.Type) =>
	new Set<IdSchema.Type>(
		runtime.items.flatMap(({ item, quantity }) =>
			quantity > 0
				? [
						item.id,
					]
				: [],
		),
	);

const projectRuntimeReachabilityGraphFx = Effect.fn("projectRuntimeReachabilityGraphFx")(
	({
		graph,
		runtime,
	}: {
		readonly graph: PlannerAcquisitionGraph;
		readonly runtime: RuntimeSchema.Type;
	}) =>
		Effect.gen(function* () {
			const rootItemIds = readRuntimeRootItemIds(runtime);
			const reachability = yield* resolvePlannerRouteReachabilityFx({
				rootItemIds,
				routes: graph.routes,
			});
			const reachableItemIds = new Set(reachability.depthByItemId.keys());
			return {
				...graph,
				depthByItemId: reachability.depthByItemId,
				reachableItemIds,
				reachableRouteIds: reachability.reachableRouteIds,
				rootItemIds,
				routeDepthById: reachability.routeDepthById,
				unreachableItemIds: new Set(
					[
						...graph.itemIds,
					].filter((itemId) => !reachableItemIds.has(itemId)),
				),
				witnessRouteByItemId: reachability.witnessRouteByItemId,
			} satisfies PlannerAcquisitionGraph;
		}),
);

/**
 * Re-roots the optimistic acquisition graph in one future runtime snapshot.
 *
 * `dead-end` is a sound branch-pruning proof. `reachable` remains deliberately optimistic: exact
 * quantities, ordering, charges and engine rules are still validated by speculative execution.
 */
export const readPlannerGoalViabilityFx = Effect.fn("readPlannerGoalViabilityFx")(
	({
		goal,
		graph,
		runtime,
	}: {
		readonly goal: PlannerItemGoal;
		readonly graph: PlannerAcquisitionGraph;
		readonly runtime: RuntimeSchema.Type;
	}) =>
		Effect.gen(function* () {
			const status = yield* readPlannerItemGoalStatusFx(goal, runtime);
			if (status.satisfied)
				return {
					availableCharges: status.availableCharges,
					availableQuantity: status.availableQuantity,
					goal,
					type: "satisfied" as const,
				};

			const runtimeGraph = yield* projectRuntimeReachabilityGraphFx({
				graph,
				runtime,
			});
			const reachability = yield* readPlannerStructuralReachabilityFx({
				graph: runtimeGraph,
				itemId: goal.itemId,
			});
			return reachability.type === "reachable"
				? {
						availableCharges: status.availableCharges,
						availableQuantity: status.availableQuantity,
						goal,
						reachability,
						type: "reachable" as const,
					}
				: {
						availableCharges: status.availableCharges,
						availableQuantity: status.availableQuantity,
						goal,
						proof: reachability,
						type: "dead-end" as const,
					};
		}),
);
