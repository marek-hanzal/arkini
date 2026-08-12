import type { PlannerAcquisitionRoute } from "~/editor/planner/PlannerAcquisitionGraph";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** Monotone reachability projection for one selected set of authored acquisition routes. */
export interface PlannerRouteReachability {
	readonly depthByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly reachableRouteIds: ReadonlySet<string>;
	readonly routeDepthById: ReadonlyMap<string, number>;
	readonly witnessRouteByItemId: ReadonlyMap<IdSchema.Type, PlannerAcquisitionRoute>;
}
