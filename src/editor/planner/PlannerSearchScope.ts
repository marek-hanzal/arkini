import type { PlannerAction } from "~/editor/planner/PlannerAction";
import type { PlannerActionOutputWitness } from "~/editor/planner/PlannerActionOutputWitness";
import type {
	PlannerAcquisitionRequirement,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
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

/** One progressively widened authored route plan consumed by engine-backed search. */
export interface PlannerSearchScope {
	readonly actions: ReadonlyArray<PlannerSearchAction>;
	/** Sum of selected route-depth excesses over each locally shortest alternative. */
	readonly depthDiscrepancy: number;
	readonly id: string;
	readonly itemIds: ReadonlyArray<IdSchema.Type>;
	/** Greatest local route-depth excess selected by this widening plan. */
	readonly maximumDetourDepth: number;
	/** Exact preferred requirement for each authored any-of clause. */
	readonly preferredRequirementByClauseId: ReadonlyMap<string, PlannerAcquisitionRequirement>;
	/** Exact preferred acquisition route for non-root item goals. */
	readonly preferredRouteByItemId: ReadonlyMap<IdSchema.Type, PlannerAcquisitionRoute>;
	/** Exact preferred reacquisition route for authored start roots. */
	readonly preferredRenewalRouteByItemId: ReadonlyMap<IdSchema.Type, PlannerAcquisitionRoute>;
	readonly routeIds: ReadonlyArray<string>;
	/** Sum of selected alternative indexes, used after depth discrepancy. */
	readonly routeDiscrepancy: number;
	readonly supported: boolean;
	readonly unsupportedRoutes: ReadonlyArray<PlannerSearchUnsupportedRoute>;
}
