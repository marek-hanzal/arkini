import type { PlannerAction } from "~/editor/planner/PlannerAction";
import type { PlannerActionOutputWitness } from "~/editor/planner/PlannerActionOutputWitness";
import type { PlannerAcquisitionRoute } from "~/editor/planner/PlannerAcquisitionGraph";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

export type PlannerSearchUnsupportedRouteReason = never;

export interface PlannerSearchUnsupportedRoute {
	readonly kind: PlannerAcquisitionRoute["kind"];
	readonly outputItemId: IdSchema.Type;
	readonly reason: PlannerSearchUnsupportedRouteReason;
	readonly routeId: string;
}

interface PlannerSearchActionBase {
	readonly action: PlannerAction;
	readonly actionId: string;
	readonly depth: number;
	readonly id: string;
	readonly outputItemIds: ReadonlyArray<IdSchema.Type>;
	readonly routeIds: ReadonlyArray<string>;
}

/** One authored action resolution relevant to the selected target. */
export type PlannerSearchAction = PlannerSearchActionBase &
	(
		| {
				readonly outputMode: "canonical";
				readonly outputWitness?: never;
		  }
		| {
				readonly outputMode: "existential";
				readonly outputWitness: PlannerActionOutputWitness;
		  }
	);

/** Minimum-depth target slice consumed by engine-backed search. */
export interface PlannerSearchScope {
	readonly actions: ReadonlyArray<PlannerSearchAction>;
	readonly itemIds: ReadonlyArray<IdSchema.Type>;
	readonly routeIds: ReadonlyArray<string>;
	readonly supported: boolean;
	readonly unsupportedRoutes: ReadonlyArray<PlannerSearchUnsupportedRoute>;
}
