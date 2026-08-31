import type { EstimateRequirementGroup } from "~/estimate/fn/groupEstimateRequirementsFn";
import type { AcquisitionRoute } from "~/flow/type/AcquisitionGraph";

/** One selected authored route for the globally materialized quantity of its fact. */
export interface EstimateSelectedRoute {
	readonly actionRuns: number;
	readonly groups: ReadonlyArray<EstimateRequirementGroup>;
	readonly outputRuns: number;
	readonly producedQuantity: number;
	readonly recurrenceFactIds: ReadonlySet<string>;
	readonly route: AcquisitionRoute;
}

/**
 * Immutable selected-by-fact demand closure for one forced top route.
 *
 * Facts are globally normalized: total consumed demand competes with each selected route's
 * concurrent consumed-plus-reusable need, finite roots form one pool, and correlated outputs share
 * one authored operation.
 */
export interface EstimateWitness {
	readonly consumedByFact: ReadonlyMap<string, number>;
	readonly dependenciesByFact: ReadonlyMap<string, ReadonlySet<string>>;
	readonly factId: string;
	readonly oneTimeByFact: ReadonlyMap<string, number>;
	readonly ongoingByFact: ReadonlyMap<string, number>;
	readonly quantity: number;
	readonly requiredQuantityByFact: ReadonlyMap<string, number>;
	readonly selectedByFact: ReadonlyMap<string, EstimateSelectedRoute>;
	readonly sharedOperationIds: ReadonlySet<string>;
	readonly topRouteId: string;
}
