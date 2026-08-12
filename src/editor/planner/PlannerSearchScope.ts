import type { PlannerAction } from "~/editor/planner/PlannerAction";
import type { PlannerAcquisitionRoute } from "~/editor/planner/PlannerAcquisitionGraph";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

export type PlannerSearchUnsupportedRouteReason =
	| "charge-depletion"
	| "stochastic-output"
	| "temporary-expiry";

export interface PlannerSearchUnsupportedRoute {
	readonly kind: PlannerAcquisitionRoute["kind"];
	readonly outputItemId: IdSchema.Type;
	readonly reason: PlannerSearchUnsupportedRouteReason;
	readonly routeId: string;
}

/** One deduplicated authored action relevant to the selected target. */
export interface PlannerSearchAction {
	readonly action: PlannerAction;
	readonly depth: number;
	readonly id: string;
	readonly outputItemIds: ReadonlyArray<IdSchema.Type>;
	readonly routeIds: ReadonlyArray<string>;
}

/** Target-specific deterministic slice consumed by the first engine-backed search. */
export interface PlannerSearchScope {
	readonly actions: ReadonlyArray<PlannerSearchAction>;
	readonly itemIds: ReadonlyArray<IdSchema.Type>;
	readonly routeIds: ReadonlyArray<string>;
	readonly supported: boolean;
	readonly unsupportedRoutes: ReadonlyArray<PlannerSearchUnsupportedRoute>;
}
