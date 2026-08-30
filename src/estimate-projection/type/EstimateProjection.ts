import type {
	EditorAcquisitionRequirement,
	EditorAcquisitionRequirementUsage,
	EditorAcquisitionRouteMetadata,
} from "~/flow/type/EditorAcquisitionGraph";

export interface EstimateAmount {
	readonly factId: string;
	readonly quantity: number;
}

/** Aggregate selected-route demand grouped by authored consumption semantics. */
export interface EstimateRequirementSummary {
	readonly consumed: ReadonlyArray<EstimateAmount>;
	readonly oneTime: ReadonlyArray<EstimateAmount>;
	readonly ongoing: ReadonlyArray<EstimateAmount>;
}

export interface EstimateRequirementStep {
	/** Selected route occurrence that establishes this requirement. */
	readonly acquisitionOccurrenceId?: string;
	readonly factId: string;
	readonly quantity: number;
	/** Authored reasons that make this fact a prerequisite of the selected route. */
	readonly sources: ReadonlyArray<EditorAcquisitionRequirement["source"]>;
	readonly usage: EditorAcquisitionRequirementUsage;
}

export interface EstimateRouteStep {
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
	readonly requirements: ReadonlyArray<EstimateRequirementStep>;
	readonly rootQuantity: number;
	readonly routeId: string;
	readonly source: "root" | "route";
}

/** Public data projection of one stable quantity-specific estimate witness. */
export interface EstimateProjection {
	readonly requirementSummary: EstimateRequirementSummary;
	readonly route: EstimateRouteStep;
	readonly routeSteps: ReadonlyArray<EstimateRouteStep>;
}
