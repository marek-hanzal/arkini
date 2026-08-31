import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";

export type EditorAcquisitionRequirementUsage = "consume" | "one-time" | "ongoing";

type EditorAcquisitionOutputKind = "chance" | "guaranteed" | "replace" | "weighted";

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

interface EditorAcquisitionOperationInput {
	readonly factId: string;
	readonly quantity: QuantitySchema.Type;
}

/** Lossless authored-operation metadata shared by its output-occurrence routes. */
export interface EditorAcquisitionOperation {
	readonly id: string;
	readonly inputs: ReadonlyArray<EditorAcquisitionOperationInput>;
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
		/** Scalar expected quantity credited to this fact by one authored operation sample. */
		readonly expectedYield: number;
		readonly factId: string;
	};
	/** Number of authored actions needed for one output sample. */
	readonly runMultiplier: number;
	readonly requirements: {
		readonly allOf: ReadonlyArray<EditorAcquisitionRequirement>;
		readonly anyOf: ReadonlyArray<ReadonlyArray<EditorAcquisitionRequirement>>;
		readonly unsupported?: ReadonlyArray<EditorAcquisitionUnsupportedRequirement>;
	};
}

interface EditorAcquisitionRoot {
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
