import type {
	EditorAcquisitionLimitation,
	EditorAcquisitionRequirement,
	EditorAcquisitionRequirementUsage,
	EditorAcquisitionRouteMetadata,
} from "~/flow/domain/EditorAcquisitionGraph";

export interface EditorItemEstimateAmount {
	readonly factId: string;
	readonly quantity: number;
}

/** Aggregate selected-route demand grouped by authored consumption semantics. */
export interface EditorItemEstimateRequirementSummary {
	readonly consumed: ReadonlyArray<EditorItemEstimateAmount>;
	readonly oneTime: ReadonlyArray<EditorItemEstimateAmount>;
	readonly ongoing: ReadonlyArray<EditorItemEstimateAmount>;
}

export interface EditorItemEstimateRequirementStep {
	/** Selected route occurrence that establishes this requirement. */
	readonly acquisitionOccurrenceId?: string;
	readonly factId: string;
	readonly quantity: number;
	/** Authored reasons that make this fact a prerequisite of the selected route. */
	readonly sources: ReadonlyArray<EditorAcquisitionRequirement["source"]>;
	readonly usage: EditorAcquisitionRequirementUsage;
}

export interface EditorItemEstimateRouteStep {
	readonly actionRuns: number;
	/** Local authored work for this selected operation, excluding dependency wait time. */
	readonly durationMs: number;
	readonly factId: string;
	readonly metadata?: EditorAcquisitionRouteMetadata;
	/** Equivalent independent occurrences compressed into this scalar witness node. */
	readonly occurrenceCount: number;
	/** Stable identity of this compressed occurrence group. */
	readonly occurrenceId: string;
	readonly outputRuns: number;
	readonly quantity: number;
	readonly requirements: ReadonlyArray<EditorItemEstimateRequirementStep>;
	readonly rootQuantity: number;
	readonly routeId: string;
	readonly source: "root" | "route";
}

export type EditorItemEstimateDiagnostic =
	| {
			readonly factId: string;
			readonly kind: "quantity-limit-exceeded";
			readonly maximumQuantity: number;
			readonly quantity: number;
			readonly source: "authored-demand" | "request";
	  }
	| {
			readonly factId: string;
			readonly kind: "quantity-specific-route-not-retried";
			readonly quantity: number;
			readonly routeId: string;
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
	readonly requirementSummary: EditorItemEstimateRequirementSummary;
	/** Stable optimistic critical path with independent dependency branches overlapped. */
	readonly durationMs: number;
	readonly obtainable: true;
	readonly status: "complete";
	readonly route: EditorItemEstimateRouteStep;
	/** Selected route occurrence groups in deterministic dependency order. */
	readonly routeSteps: ReadonlyArray<EditorItemEstimateRouteStep>;
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
