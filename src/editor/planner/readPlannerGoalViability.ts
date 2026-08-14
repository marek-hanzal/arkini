import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerGoalViability, PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import { readPlannerItemGoalStatus } from "~/editor/planner/readPlannerItemGoalStatus";
import { readPlannerStructuralReachability } from "~/editor/planner/readPlannerStructuralReachability";
import { resolvePlannerRouteReachability } from "~/editor/planner/resolvePlannerRouteReachability";
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

const projectRuntimeReachabilityGraph = ({
	graph,
	runtime,
}: {
	readonly graph: PlannerAcquisitionGraph;
	readonly runtime: RuntimeSchema.Type;
}): PlannerAcquisitionGraph => {
	const rootItemIds = readRuntimeRootItemIds(runtime);
	const reachability = resolvePlannerRouteReachability({
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
	};
};

/**
 * Re-roots the optimistic acquisition graph in one future runtime snapshot.
 *
 * `dead-end` is a sound branch-pruning proof. `reachable` remains deliberately optimistic: exact
 * quantities, ordering, charges and engine rules are still validated by speculative execution.
 */
export const readPlannerGoalViability = ({
	goal,
	graph,
	runtime,
}: {
	readonly goal: PlannerItemGoal;
	readonly graph: PlannerAcquisitionGraph;
	readonly runtime: RuntimeSchema.Type;
}): PlannerGoalViability => {
	const status = readPlannerItemGoalStatus(goal, runtime);
	if (status.satisfied)
		return {
			availableCharges: status.availableCharges,
			availableQuantity: status.availableQuantity,
			goal,
			type: "satisfied",
		};

	const reachability = readPlannerStructuralReachability({
		graph: projectRuntimeReachabilityGraph({
			graph,
			runtime,
		}),
		itemId: goal.itemId,
	});
	return reachability.type === "reachable"
		? {
				availableCharges: status.availableCharges,
				availableQuantity: status.availableQuantity,
				goal,
				reachability,
				type: "reachable",
			}
		: {
				availableCharges: status.availableCharges,
				availableQuantity: status.availableQuantity,
				goal,
				proof: reachability,
				type: "dead-end",
			};
};
