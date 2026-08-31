import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";
import type {
	AcquisitionRequirement,
	AcquisitionUnsupportedRequirement,
} from "~/flow/type/AcquisitionGraph";

export type ItemOriginOperationKind = "line" | "charges" | "merge" | "expiry";
type ItemOriginOutputKind = "guaranteed" | "chance" | "weighted" | "replace";

export interface ItemOriginOutputOccurrence {
	readonly itemId: string;
	readonly placement: "drop" | "random" | undefined;
	readonly quantity: QuantitySchema.Type;
	/** Exact acquisition route represented by this output occurrence. */
	readonly routeId: string;
	readonly requirements: ItemOriginOutputRequirements;
	readonly selectionKind: ItemOriginOutputKind;
	readonly weightedSet: boolean;
}

export interface ItemOriginInputOccurrence {
	readonly itemId: string;
	readonly quantity: QuantitySchema.Type;
}

export interface ItemOriginRequirementOccurrence extends ItemOriginInputOccurrence {
	readonly identity?: AcquisitionRequirement["identity"];
	readonly sources: ReadonlyArray<AcquisitionRequirement["source"]>;
	readonly usage: AcquisitionRequirement["usage"];
}

export interface ItemOriginOutputRequirements {
	readonly allOf: ReadonlyArray<ItemOriginRequirementOccurrence>;
	readonly anyOf: ReadonlyArray<ReadonlyArray<ItemOriginRequirementOccurrence>>;
	readonly unsupported?: ReadonlyArray<ItemOriginUnsupportedRequirementOccurrence>;
}

export interface ItemOriginUnsupportedRequirementOccurrence {
	readonly itemId: string;
	readonly reason: AcquisitionUnsupportedRequirement["reason"];
	readonly source: AcquisitionUnsupportedRequirement["source"];
}

export type ItemOriginSourceReference =
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

export interface ItemOriginSource {
	readonly id: string;
	readonly inputs: ReadonlyArray<ItemOriginInputOccurrence>;
	readonly kind: ItemOriginOperationKind;
	readonly label: string;
	readonly outputs: ReadonlyArray<ItemOriginOutputOccurrence>;
	readonly ownerItemId: string;
	readonly reference: ItemOriginSourceReference;
	/** Convenience union for graph traversal; clause truth lives on each output occurrence. */
	readonly requirementItemIds: ReadonlyArray<string>;
	/** Acquisition occurrence routes represented by this authored operation. */
	readonly routeIds: ReadonlyArray<string>;
	readonly runtimeMs?: number;
}

export type ItemOriginRelationRole = "input" | "output";

export interface ItemOriginRelation {
	readonly fromItemId: string;
	readonly outputIndex?: number;
	readonly role: ItemOriginRelationRole;
	readonly source: ItemOriginSource;
	readonly toItemId: string;
}
