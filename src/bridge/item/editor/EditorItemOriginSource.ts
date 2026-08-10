import type { EditorItemOriginOperationKind } from "~/bridge/item/editor/EditorItemOriginFlow";

export type EditorItemOriginOutputKind = "guaranteed" | "chance" | "weighted" | "replace";

export interface EditorItemOriginOutputOccurrence {
	readonly itemId: string;
	readonly placement: "drop" | "random" | undefined;
	readonly selectionKind: EditorItemOriginOutputKind;
	readonly weightedSet: boolean;
}

export interface EditorItemOriginSource {
	readonly id: string;
	readonly kind: EditorItemOriginOperationKind;
	readonly label: string;
	readonly outputs: ReadonlyArray<EditorItemOriginOutputOccurrence>;
	readonly ownerItemId: string;
	readonly requirementItemIds: ReadonlyArray<string>;
}
