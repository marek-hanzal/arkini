import type { PlannerAction } from "~/editor/planner/PlannerAction";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

export type PlannerExpectedEconomicsAssumption =
	| "fractional-demands-use-linear-interpolation"
	| "independent-output-resolutions"
	| "operations-run-sequentially"
	| "optimistic-engine-policies"
	| "same-step-canonical-flows-are-netted"
	| "selected-trace-actions-remain-repeatable";

export interface PlannerExpectedEconomicsChargeQuantity {
	readonly charges: number;
	readonly itemId: IdSchema.Type;
}

export interface PlannerExpectedEconomicsItemQuantity {
	readonly itemId: IdSchema.Type;
	readonly quantity: number;
}

/** One initially available line owner required by the selected witness. */
export interface PlannerExpectedEconomicsRequiredActor
	extends PlannerExpectedEconomicsItemQuantity {}

/** One canonical item quantity produced by the selected expected trace replay. */
export interface PlannerExpectedEconomicsAcquiredItem extends PlannerExpectedEconomicsItemQuantity {
	/** Expected elapsed time when the complete aggregated quantity has become available. */
	readonly readyAtMs: number;
}

export interface PlannerExpectedEconomicsOperation {
	readonly action: PlannerAction;
	readonly actionId: string;
	readonly expectedElapsedMs: number;
	readonly expectedRuns: number;
	readonly observedElapsedMs: number;
	readonly observedRuns: number;
}

/** Expected replay cost of one concrete engine-valid planner trace. */
export interface PlannerExpectedEconomics {
	readonly assumptions: ReadonlyArray<PlannerExpectedEconomicsAssumption>;
	readonly expectedActionRuns: number;
	/** Canonical items created by the expected selected-trace replay, including infrastructure. */
	readonly expectedAcquiredItems: ReadonlyArray<PlannerExpectedEconomicsAcquiredItem>;
	/** Direct net canonical item removals across the expected selected-trace replay. */
	readonly expectedConsumedItems: ReadonlyArray<PlannerExpectedEconomicsItemQuantity>;
	readonly expectedElapsedMs: number;
	/** Initially available line owners actually used by the selected concrete witness. */
	readonly requiredInitialActors: ReadonlyArray<PlannerExpectedEconomicsRequiredActor>;
	/** Canonical charge units spent, including non-terminal spends. */
	readonly expectedSpentCharges: ReadonlyArray<PlannerExpectedEconomicsChargeQuantity>;
	readonly initialTargetQuantity: number;
	readonly method: "selected-trace-replay";
	/** Concrete target-witness actions after pruning unrelated exploration steps. */
	readonly observedActionRuns: number;
	/** Concrete sequential authored time of the pruned target witness. */
	readonly observedElapsedMs: number;
	/** Certainty of the pruned target witness, excluding unrelated exploration rolls. */
	readonly observedOutputCertainty: "deterministic" | "possible";
	/** Product of stochastic witness probabilities used by the pruned target witness. */
	readonly observedSelectedWitnessProbability: number;
	readonly operations: ReadonlyArray<PlannerExpectedEconomicsOperation>;
	readonly requiredAdditionalTargetQuantity: number;
	readonly targetItemId: IdSchema.Type;
	readonly targetQuantity: number;
	readonly totalExpectedAcquiredQuantity: number;
	readonly totalExpectedConsumedQuantity: number;
	readonly totalExpectedSpentCharges: number;
}
