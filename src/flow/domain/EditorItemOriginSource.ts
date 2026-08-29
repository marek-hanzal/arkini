import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";
import type {
	EditorAcquisitionRequirement,
	EditorAcquisitionUnsupportedRequirement,
} from "~/flow/domain/EditorAcquisitionGraph";

export type EditorItemOriginOperationKind = "line" | "charges" | "merge" | "expiry";
export type EditorItemOriginOutputKind = "guaranteed" | "chance" | "weighted" | "replace";

export interface EditorItemOriginOutputOccurrence {
	readonly itemId: string;
	readonly placement: "drop" | "random" | undefined;
	readonly quantity: QuantitySchema.Type;
	/** Exact acquisition route represented by this output occurrence. */
	readonly routeId: string;
	readonly requirements: EditorItemOriginOutputRequirements;
	readonly selectionKind: EditorItemOriginOutputKind;
	readonly weightedSet: boolean;
}

export interface EditorItemOriginInputOccurrence {
	readonly itemId: string;
	readonly quantity: QuantitySchema.Type;
}

export interface EditorItemOriginRequirementOccurrence extends EditorItemOriginInputOccurrence {
	readonly identity?: EditorAcquisitionRequirement["identity"];
	readonly sources: ReadonlyArray<EditorAcquisitionRequirement["source"]>;
	readonly usage: EditorAcquisitionRequirement["usage"];
}

export interface EditorItemOriginOutputRequirements {
	readonly allOf: ReadonlyArray<EditorItemOriginRequirementOccurrence>;
	readonly anyOf: ReadonlyArray<ReadonlyArray<EditorItemOriginRequirementOccurrence>>;
	readonly unsupported?: ReadonlyArray<EditorItemOriginUnsupportedRequirementOccurrence>;
}

export interface EditorItemOriginUnsupportedRequirementOccurrence {
	readonly itemId: string;
	readonly reason: EditorAcquisitionUnsupportedRequirement["reason"];
	readonly source: EditorAcquisitionUnsupportedRequirement["source"];
}

export type EditorItemOriginSourceReference =
	| {
			readonly type: "line";
			readonly lineId: string;
	  }
	| {
			readonly type: "charges";
	  }
	| {
			readonly type: "expiry";
	  }
	| {
			readonly type: "merge";
			readonly ruleNumber: number;
	  };

export interface EditorItemOriginSource {
	readonly id: string;
	readonly inputs: ReadonlyArray<EditorItemOriginInputOccurrence>;
	readonly kind: EditorItemOriginOperationKind;
	readonly label: string;
	readonly outputs: ReadonlyArray<EditorItemOriginOutputOccurrence>;
	readonly ownerItemId: string;
	readonly reference: EditorItemOriginSourceReference;
	/** Convenience union for graph traversal; clause truth lives on each output occurrence. */
	readonly requirementItemIds: ReadonlyArray<string>;
	/** Acquisition occurrence routes represented by this authored operation. */
	readonly routeIds: ReadonlyArray<string>;
	readonly runtimeMs?: number;
}

export type EditorItemOriginRelationRole = "input" | "output";

export interface EditorItemOriginRelation {
	readonly fromItemId: string;
	readonly outputIndex?: number;
	readonly role: EditorItemOriginRelationRole;
	readonly source: EditorItemOriginSource;
	readonly toItemId: string;
}

export interface EditorItemOriginRelationSubgraph {
	readonly itemIds: ReadonlySet<string>;
	readonly relations: ReadonlyArray<
		EditorItemOriginRelation & {
			readonly level: number;
		}
	>;
}
