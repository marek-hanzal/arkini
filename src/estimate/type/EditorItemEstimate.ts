import type { EditorAcquisitionLimitation } from "~/flow/type/EditorAcquisitionGraph";
import type {
	EstimateRequirementSummary,
	EstimateRouteStep,
} from "~/estimate-projection/type/EstimateProjection";

export type EditorItemEstimateDiagnostic =
	| {
			readonly factId: string;
			readonly kind: "any-of-selection-limit-exceeded";
			readonly maximumSelections: number;
			readonly routeId: string;
	  }
	| {
			readonly factId: string;
			readonly kind: "retained-demand-not-stable";
			readonly maximumIterations: number;
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

interface EditorItemEstimateBase {
	/** Bounded evidence for partial or unreachable estimates. */
	readonly diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>;
	readonly factId: string;
	readonly limitations: ReadonlyArray<EditorAcquisitionLimitation>;
	readonly quantity: number;
}

export interface ObtainableEditorItemEstimate extends EditorItemEstimateBase {
	readonly requirementSummary: EstimateRequirementSummary;
	/** Stable optimistic critical path with independent dependency branches overlapped. */
	readonly durationMs: number;
	readonly obtainable: true;
	readonly status: "complete";
	readonly route: EstimateRouteStep;
	/** Selected route occurrence groups in deterministic dependency order. */
	readonly routeSteps: ReadonlyArray<EstimateRouteStep>;
}

export interface UnreachableEditorItemEstimate extends EditorItemEstimateBase {
	readonly obtainable: false;
	readonly status: "unreachable";
}

export interface PartialEditorItemEstimate extends EditorItemEstimateBase {
	readonly obtainable: false;
	readonly status: "partial";
}

export type EditorItemEstimate =
	| ObtainableEditorItemEstimate
	| PartialEditorItemEstimate
	| UnreachableEditorItemEstimate;
