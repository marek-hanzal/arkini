import type { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";

export type EditorAcquisitionRequirementUsage = "consume" | "one-time" | "ongoing";

export type EditorAcquisitionOutputKind = "chance" | "guaranteed" | "replace" | "weighted";

export interface EditorAcquisitionOutputAnnotation {
	readonly alternativeSet: boolean;
	readonly placement: "drop" | "random" | undefined;
	readonly quantity: QuantitySchema.Type;
	readonly selectionKind: EditorAcquisitionOutputKind;
}

export interface EditorAcquisitionRequirement {
	readonly factId: string;
	/** This occurrence must use a separate live identity from sibling distinct occurrences. */
	readonly identity?: "distinct";
	readonly quantity: number;
	readonly source:
		| "charged-item"
		| "deposit-input"
		| "line-condition"
		| "material-input"
		| "merge-source"
		| "merge-target"
		| "output-condition"
		| "owner"
		| "temporary-item";
	readonly usage: EditorAcquisitionRequirementUsage;
}

export interface EditorAcquisitionUnsupportedRequirement {
	readonly factId: string;
	readonly reason: "exact-count" | "negative-condition" | "upper-bound";
	readonly source: "line-condition" | "output-condition";
}

export interface EditorAcquisitionQuantityProbability {
	readonly probability: number;
	readonly quantity: number;
}

export interface EditorAcquisitionOperationInput {
	readonly factId: string;
	readonly quantity: QuantitySchema.Type;
}

export interface EditorAcquisitionOperationOutcome {
	readonly probability: number;
	readonly quantities: ReadonlyArray<{
		readonly outputGroupId: string;
		readonly quantity: number;
	}>;
}

/** Lossless authored-operation metadata shared by its output-occurrence routes. */
export interface EditorAcquisitionOperation {
	readonly id: string;
	readonly inputs: ReadonlyArray<EditorAcquisitionOperationInput>;
	/** Explicitly prevents Estimate from treating an uncompiled distribution as zero yield. */
	readonly outputCompilation?: "state-space-unsupported";
	/** Joint distribution of all correlated outputs produced by one operation sample. */
	readonly outputDistribution?: ReadonlyArray<EditorAcquisitionOperationOutcome>;
}

export type EditorAcquisitionRouteMetadata =
	| {
			readonly kind: "line-output";
			readonly lineId: string;
			readonly lineTitle: string;
			readonly ownerItemId: string;
	  }
	| {
			readonly chargedItemId: string;
			readonly kind: "line-charge-depletion";
			readonly lineId: string;
			readonly lineTitle: string;
			readonly ownerItemId: string;
	  }
	| {
			readonly kind: "merge-output";
			readonly mergeIndex: number;
			readonly sourceItemId: string;
			readonly targetItemId: string;
	  }
	| {
			readonly itemId: string;
			readonly kind: "temporary-expiry";
	  };

export interface EditorAcquisitionRoute {
	readonly chargeUses?: ReadonlyArray<{
		/** Signals when concrete payer-identity packing cannot be summarized statically. */
		readonly accounting?: "multi-payer-unsupported" | "single-payer-exact";
		readonly payerFactId: string;
		/** Compatibility summary for the exact single-payer case; zero means unsupported. */
		readonly usableActionRuns: number;
	}>;
	readonly durationMs: number;
	readonly id: string;
	readonly metadata: EditorAcquisitionRouteMetadata;
	readonly operation?: EditorAcquisitionOperation;
	readonly output: {
		readonly annotation: EditorAcquisitionOutputAnnotation;
		readonly factId: string;
		/** Correlated operation-output bucket credited by this occurrence route. */
		readonly operationOutputGroupId?: string;
		readonly quantityDistribution: ReadonlyArray<EditorAcquisitionQuantityProbability>;
	};
	/** Number of authored actions needed for one output-distribution sample. */
	readonly runMultiplier: number;
	readonly requirements: {
		readonly allOf: ReadonlyArray<EditorAcquisitionRequirement>;
		readonly anyOf: ReadonlyArray<ReadonlyArray<EditorAcquisitionRequirement>>;
		readonly unsupported?: ReadonlyArray<EditorAcquisitionUnsupportedRequirement>;
	};
}

export interface EditorAcquisitionRoot {
	readonly factId: string;
	readonly quantity: number | "unbounded";
}

export type EditorAcquisitionLimitation =
	| "conditional-runtime-adjustments-ignored"
	| "negative-availability-constraints-ignored"
	| "spatial-requirements-approximated";

/** Immutable editor-owned projection of authored acquisition facts and routes. */
export interface EditorAcquisitionGraph {
	readonly factIds: ReadonlyArray<string>;
	readonly limitations: ReadonlyArray<EditorAcquisitionLimitation>;
	readonly roots: ReadonlyArray<EditorAcquisitionRoot>;
	readonly routes: ReadonlyArray<EditorAcquisitionRoute>;
}
