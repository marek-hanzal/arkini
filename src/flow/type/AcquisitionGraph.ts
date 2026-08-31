import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";

export type AcquisitionRequirementUsage = "consume" | "one-time" | "ongoing";

type AcquisitionOutputKind = "chance" | "guaranteed" | "replace" | "weighted";

export interface AcquisitionOutputAnnotation {
	readonly alternativeSet: boolean;
	readonly placement: "drop" | "random" | undefined;
	readonly quantity: QuantitySchema.Type;
	readonly selectionKind: AcquisitionOutputKind;
}

export interface AcquisitionRequirement {
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
	readonly usage: AcquisitionRequirementUsage;
}

export interface AcquisitionUnsupportedRequirement {
	readonly factId: string;
	readonly reason: "exact-count" | "negative-condition" | "upper-bound";
	readonly source: "line-condition" | "output-condition";
}

export interface AcquisitionQuantityProbability {
	readonly probability: number;
	readonly quantity: number;
}

export interface AcquisitionOperationInput {
	readonly factId: string;
	readonly quantity: QuantitySchema.Type;
}

export interface AcquisitionOperationOutcome {
	readonly probability: number;
	readonly quantities: ReadonlyArray<{
		readonly outputGroupId: string;
		readonly quantity: number;
	}>;
}

/** Lossless authored-operation metadata shared by its output-occurrence routes. */
export interface AcquisitionOperation {
	readonly id: string;
	readonly inputs: ReadonlyArray<AcquisitionOperationInput>;
	/** Explicitly prevents Estimate from treating an uncompiled distribution as zero yield. */
	readonly outputCompilation?: "state-space-unsupported";
	/** Joint distribution of all correlated outputs produced by one operation sample. */
	readonly outputDistribution?: ReadonlyArray<AcquisitionOperationOutcome>;
}

export type AcquisitionRouteMetadata =
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

export interface AcquisitionRoute {
	readonly chargeUses?: ReadonlyArray<{
		/** Signals when concrete payer-identity packing cannot be summarized statically. */
		readonly accounting?: "multi-payer-unsupported" | "single-payer-exact";
		readonly payerFactId: string;
		/** Compatibility summary for the exact single-payer case; zero means unsupported. */
		readonly usableActionRuns: number;
	}>;
	readonly durationMs: number;
	readonly id: string;
	readonly metadata: AcquisitionRouteMetadata;
	readonly operation?: AcquisitionOperation;
	readonly output: {
		readonly annotation: AcquisitionOutputAnnotation;
		readonly factId: string;
		/** Correlated operation-output bucket credited by this occurrence route. */
		readonly operationOutputGroupId?: string;
		readonly quantityDistribution: ReadonlyArray<AcquisitionQuantityProbability>;
	};
	/** Number of authored actions needed for one output-distribution sample. */
	readonly runMultiplier: number;
	readonly requirements: {
		readonly allOf: ReadonlyArray<AcquisitionRequirement>;
		readonly anyOf: ReadonlyArray<ReadonlyArray<AcquisitionRequirement>>;
		readonly unsupported?: ReadonlyArray<AcquisitionUnsupportedRequirement>;
	};
}

export interface AcquisitionRoot {
	readonly factId: string;
	readonly quantity: number | "unbounded";
}

export type AcquisitionLimitation =
	| "conditional-runtime-adjustments-ignored"
	| "negative-availability-constraints-ignored"
	| "spatial-requirements-approximated";

/** Immutable projection of authored acquisition facts and routes. */
export interface AcquisitionGraph {
	readonly factIds: ReadonlyArray<string>;
	readonly limitations: ReadonlyArray<AcquisitionLimitation>;
	readonly roots: ReadonlyArray<AcquisitionRoot>;
	readonly routes: ReadonlyArray<AcquisitionRoute>;
}
