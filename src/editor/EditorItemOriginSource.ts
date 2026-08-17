import type { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";

export type EditorItemOriginOperationKind = "line" | "charges" | "merge" | "expiry";
export type EditorItemOriginOutputKind = "guaranteed" | "chance" | "weighted" | "replace";

export interface EditorItemOriginOutputOccurrence {
	readonly itemId: string;
	readonly placement: "drop" | "random" | undefined;
	readonly quantity: QuantitySchema.Type;
	readonly selectionKind: EditorItemOriginOutputKind;
	readonly weightedSet: boolean;
}

export interface EditorItemOriginInputOccurrence {
	readonly itemId: string;
	readonly quantity: QuantitySchema.Type;
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
	readonly requirementItemIds: ReadonlyArray<string>;
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

export interface EditorItemOriginIncomeSubgraph {
	readonly itemIds: ReadonlySet<string>;
	readonly sources: ReadonlyArray<EditorItemOriginSource>;
}
