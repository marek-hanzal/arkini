import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerGoalViability, PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import { readPlannerRuntimeQuantity } from "~/editor/planner/readPlannerRuntimeQuantity";
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
	if (!Number.isSafeInteger(goal.quantity) || goal.quantity < 1)
		throw new RangeError(
			`Planner goal quantity must be a positive safe integer, received ${goal.quantity}.`,
		);

	const availableQuantity = readPlannerRuntimeQuantity(runtime, goal.itemId);
	if (availableQuantity >= goal.quantity)
		return {
			availableQuantity,
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
				availableQuantity,
				goal,
				reachability,
				type: "reachable",
			}
		: {
				availableQuantity,
				goal,
				proof: reachability,
				type: "dead-end",
			};
};
