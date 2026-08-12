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
	/** Direct net canonical item removals across the expected selected-trace replay. */
	readonly expectedConsumedItems: ReadonlyArray<PlannerExpectedEconomicsItemQuantity>;
	readonly expectedElapsedMs: number;
	/** Canonical charge units spent, including non-terminal spends. */
	readonly expectedSpentCharges: ReadonlyArray<PlannerExpectedEconomicsChargeQuantity>;
	readonly initialTargetQuantity: number;
	readonly method: "selected-trace-replay";
	readonly observedActionRuns: number;
	readonly observedElapsedMs: number;
	readonly operations: ReadonlyArray<PlannerExpectedEconomicsOperation>;
	readonly requiredAdditionalTargetQuantity: number;
	readonly targetItemId: IdSchema.Type;
	readonly targetQuantity: number;
	readonly totalExpectedConsumedQuantity: number;
	readonly totalExpectedSpentCharges: number;
}
