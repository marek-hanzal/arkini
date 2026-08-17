import type {
	EditorEstimateLimitation,
	EditorEstimateRequirementUsage,
	EditorEstimateRouteMetadata,
} from "~/editor/estimator/EditorEstimateDependencyGraph";

export interface EditorItemEstimateAmount {
	readonly factId: string;
	readonly quantity: number;
}

export interface EditorItemEstimateRequirementStep {
	readonly acquisition?: EditorItemEstimateRouteStep;
	readonly factId: string;
	readonly quantity: number;
	readonly usage: EditorEstimateRequirementUsage;
}

export interface EditorItemEstimateRouteStep {
	readonly actionRuns: number;
	readonly durationMs: number;
	readonly factId: string;
	readonly metadata?: EditorEstimateRouteMetadata;
	readonly outputRuns: number;
	readonly quantity: number;
	readonly requirements: ReadonlyArray<EditorItemEstimateRequirementStep>;
	readonly rootQuantity: number;
	readonly routeId: string;
	readonly source: "root" | "route";
}

export type EditorItemEstimateDiagnostic =
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

export interface EditorItemEstimateRejectedRoute {
	readonly diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>;
	readonly routeId: string;
}

interface EditorItemEstimateBase {
	readonly diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>;
	readonly factId: string;
	readonly limitations: ReadonlyArray<EditorEstimateLimitation>;
	readonly quantity: number;
	readonly rejectedRoutes: ReadonlyArray<EditorItemEstimateRejectedRoute>;
}

export interface ObtainableEditorItemEstimate extends EditorItemEstimateBase {
	readonly consumables: ReadonlyArray<EditorItemEstimateAmount>;
	readonly durationMs: number;
	readonly obtainable: true;
	readonly oneTimeRequirements: ReadonlyArray<EditorItemEstimateAmount>;
	readonly ongoingRequirements: ReadonlyArray<EditorItemEstimateAmount>;
	readonly route: EditorItemEstimateRouteStep;
}

export interface UnreachableEditorItemEstimate extends EditorItemEstimateBase {
	readonly obtainable: false;
}

export type EditorItemEstimate = ObtainableEditorItemEstimate | UnreachableEditorItemEstimate;
