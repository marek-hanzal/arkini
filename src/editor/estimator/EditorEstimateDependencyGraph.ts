export type EditorEstimateRequirementUsage = "consume" | "one-time" | "ongoing";

export interface EditorEstimateRequirement {
	readonly factId: string;
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
	readonly usage: EditorEstimateRequirementUsage;
}

export interface EditorEstimateQuantityProbability {
	readonly probability: number;
	readonly quantity: number;
}

export type EditorEstimateRouteMetadata =
	| {
			readonly kind: "line-output";
			readonly lineId: string;
			readonly ownerItemId: string;
	  }
	| {
			readonly chargedItemId: string;
			readonly kind: "line-charge-depletion";
			readonly lineId: string;
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

export interface EditorEstimateRoute {
	readonly durationMs: number;
	readonly id: string;
	readonly metadata: EditorEstimateRouteMetadata;
	readonly output: {
		readonly factId: string;
		readonly quantityDistribution: ReadonlyArray<EditorEstimateQuantityProbability>;
	};
	/** Number of authored actions needed for one output-distribution sample. */
	readonly runMultiplier: number;
	readonly requirements: {
		readonly allOf: ReadonlyArray<EditorEstimateRequirement>;
		readonly anyOf: ReadonlyArray<ReadonlyArray<EditorEstimateRequirement>>;
	};
}

export interface EditorEstimateRoot {
	readonly factId: string;
	readonly quantity: number | "unbounded";
}

export type EditorEstimateLimitation =
	| "charge-renewal-approximated"
	| "conditional-runtime-adjustments-ignored"
	| "spatial-requirements-approximated";

/** Immutable authored facts consumed by the static editor estimator. */
export interface EditorEstimateDependencyGraph {
	readonly factIds: ReadonlyArray<string>;
	readonly limitations: ReadonlyArray<EditorEstimateLimitation>;
	readonly roots: ReadonlyArray<EditorEstimateRoot>;
	readonly routes: ReadonlyArray<EditorEstimateRoute>;
}
