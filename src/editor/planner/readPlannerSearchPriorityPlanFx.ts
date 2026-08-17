import { Effect } from "effect";

import { readPlannerActionIdFx } from "~/editor/planner/readPlannerActionIdFx";
import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerSearchPriorityPlan } from "~/editor/planner/PlannerSearchPriorityPlan";
import type { PlannerSearchScope } from "~/editor/planner/PlannerSearchScope";
import { resolvePlannerRouteReachabilityFx } from "~/editor/planner/resolvePlannerRouteReachabilityFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

const readMaximumSingleActionOutputByItemIdFx = Effect.fn(
	"readPlannerSearchPriorityPlanFx.maximumSingleActionOutputByItemId",
)(function* ({ routes }: { readonly routes: ReadonlyArray<PlannerAcquisitionRoute> }) {
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
		const actionId = yield* readPlannerActionIdFx(route.action);
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
});

/** Creates the deterministic preferred witness used only to order forward-search states. */
export const readPlannerSearchPriorityPlanFx = Effect.fn("readPlannerSearchPriorityPlanFx")(
	function* ({
		graph,
		scope,
	}: {
		readonly graph: PlannerAcquisitionGraph;
		readonly scope: PlannerSearchScope;
	}) {
		const scopeRouteIds = new Set(scope.routeIds);
		const scopeReachability = yield* resolvePlannerRouteReachabilityFx({
			rootItemIds: graph.rootItemIds,
			routes: graph.routes.filter((route) => scopeRouteIds.has(route.id)),
		});
		return {
			chargeCapacityByItemId: graph.chargeCapacityByItemId,
			depthByItemId: scopeReachability.depthByItemId,
			maximumSingleActionOutputByItemId: yield* readMaximumSingleActionOutputByItemIdFx({
				routes: graph.routes.filter((route) => scopeRouteIds.has(route.id)),
			}),
			preferredRequirementByClauseId: scope.preferredRequirementByClauseId,
			renewalRouteByItemId: scope.preferredRenewalRouteByItemId,
			witnessRouteByItemId: scope.preferredRouteByItemId,
		} satisfies PlannerSearchPriorityPlan;
	},
);
