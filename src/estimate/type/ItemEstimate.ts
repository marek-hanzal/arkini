import type { AcquisitionLimitation } from "~/flow/type/AcquisitionGraph";
import type {
	EstimateRequirementSummary,
	EstimateRouteStep,
} from "~/estimate/type/EstimateProjection";

export type ItemEstimateDiagnostic =
	| {
			readonly kind: "joint-output-accounting-unsupported";
			readonly reason: "state-space";
			readonly routeId: string;
	  }
	| {
			readonly kind: "witness-search-exhausted";
			readonly maximumStates: number;
			readonly routeId: string;
	  }
	| {
			readonly factId: string;
			readonly kind: "quantity-limit-exceeded";
			readonly maximumQuantity: number;
			readonly quantity: number;
			readonly source: "authored-demand" | "request";
	  }
	| {
			readonly factIds: ReadonlyArray<string>;
			readonly kind: "cycle";
			readonly routeId: string;
	  }
	| {
			readonly factId: string;
			readonly kind: "unreachable";
			readonly quantity: number;
			readonly routeId?: string;
	  }
	| {
			readonly factId: string;
			readonly kind: "zero-yield";
			readonly routeId: string;
	  };

interface ItemEstimateBase {
	/** Bounded evidence for partial or unreachable estimates. */
	readonly diagnostics: ReadonlyArray<ItemEstimateDiagnostic>;
	readonly factId: string;
	readonly limitations: ReadonlyArray<AcquisitionLimitation>;
	readonly quantity: number;
}

export interface ObtainableItemEstimate extends ItemEstimateBase {
	readonly requirementSummary: EstimateRequirementSummary;
	/** Stable optimistic critical path with independent dependency branches overlapped. */
	readonly durationMs: number;
	readonly obtainable: true;
	readonly status: "complete";
	readonly route: EstimateRouteStep;
	/** Normalized selected-route DAG. Every acquired fact occurs exactly once. */
	readonly routeSteps: ReadonlyArray<EstimateRouteStep>;
}

export interface UnreachableItemEstimate extends ItemEstimateBase {
	readonly obtainable: false;
	readonly status: "unreachable";
}

export interface PartialItemEstimate extends ItemEstimateBase {
	readonly obtainable: false;
	readonly status: "partial";
}

export type ItemEstimate = ObtainableItemEstimate | PartialItemEstimate | UnreachableItemEstimate;
