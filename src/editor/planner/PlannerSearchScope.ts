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

interface PlannerSearchScopeChoiceBase {
	/** Zero-based authored alternative selected by this route plan. */
	readonly alternativeIndex: number;
	readonly alternativeCount: number;
	/** Selected structural depth minus the locally shortest alternative depth. */
	readonly depthExcess: number;
	readonly key: string;
	readonly minimumDepth: number;
	readonly selectedDepth: number;
}

/** One explicit authored alternative selected while building a progressive route plan. */
export type PlannerSearchScopeChoice = PlannerSearchScopeChoiceBase &
	(
		| {
				readonly itemId: IdSchema.Type;
				readonly routeId: string;
				readonly type: "acquisition-route" | "renewal-route";
		  }
		| {
				readonly clauseId: string;
				readonly itemId: IdSchema.Type;
				readonly source: PlannerAcquisitionRequirement["source"];
				readonly type: "requirement";
				readonly usage: PlannerAcquisitionRequirement["usage"];
		  }
	);

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
	/** Every authored alternative selected by this route plan, including shortest defaults. */
	readonly choices: ReadonlyArray<PlannerSearchScopeChoice>;
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
