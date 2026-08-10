import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";

export type EditorItemOriginOperationKind = "line" | "charges" | "merge" | "expiry";

export const EditorItemOriginItemInputPortId = "item:self:input";
export const EditorItemOriginItemOutputPortId = "item:self:output";

interface EditorItemOriginOperationPort {
	readonly id: string;
	readonly itemId: string;
	readonly label: string;
}

export interface EditorItemOriginOperation {
	readonly id: string;
	readonly inputs: ReadonlyArray<EditorItemOriginOperationPort>;
	readonly kind: EditorItemOriginOperationKind;
	readonly label: string;
	readonly outputs: ReadonlyArray<EditorItemOriginOperationPort>;
}

export interface EditorItemOriginItemNode {
	readonly acquisitionSourceId?: string;
	readonly id: string;
	readonly itemId: string;
	readonly operations: ReadonlyArray<EditorItemOriginOperation>;
	readonly resourceIds: EditorItem["asset"]["default"];
	readonly starterScopes: ReadonlyArray<"Board" | "Inventory" | "Toolbar">;
	readonly title: string;
	readonly type: EditorItem["type"] | "missing";
}

export interface EditorItemOriginEdge {
	readonly id: string;
	readonly operationId: string;
	readonly role: "input" | "output";
	readonly source: string;
	readonly sourcePortId?: string;
	readonly target: string;
	readonly targetPortId?: string;
}

export interface EditorItemOriginFlow {
	readonly edges: ReadonlyArray<EditorItemOriginEdge>;
	readonly nodes: ReadonlyArray<EditorItemOriginItemNode>;
}

export interface EditorItemOriginFlowProgress {
	readonly label: string;
	readonly percent: number;
}
