import type {
	EditorAcquisitionLimitation,
	EditorAcquisitionRequirement,
	EditorAcquisitionRequirementUsage,
	EditorAcquisitionRouteMetadata,
} from "~/editor/EditorAcquisitionGraph";

export interface EditorItemEstimateRequirementStep {
	/** Canonical fact whose route establishes this requirement, when acquisition is needed. */
	readonly acquisitionFactId?: string;
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
			readonly kind: "joint-output-accounting-unsupported";
			readonly reason: "state-space";
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
	readonly diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>;
	readonly factId: string;
	readonly limitations: ReadonlyArray<EditorAcquisitionLimitation>;
	readonly quantity: number;
}

export interface ObtainableEditorItemEstimate extends EditorItemEstimateBase {
	/** Stable optimistic critical path with independent dependency branches overlapped. */
	readonly durationMs: number;
	readonly obtainable: true;
	readonly status: "complete";
	readonly route: EditorItemEstimateRouteStep;
	/** Normalized selected-route DAG. Every acquired fact occurs exactly once. */
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
