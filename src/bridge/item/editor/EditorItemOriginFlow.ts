import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import type {
	EditorItemOriginRequirementOccurrence,
	EditorItemOriginUnsupportedRequirementOccurrence,
} from "~/editor/EditorItemOriginSource";

export type EditorItemOriginOperationKind = "line" | "charges" | "merge" | "expiry";

export const EditorItemOriginItemInputPortId = "item:self:input";
export const EditorItemOriginItemOutputPortId = "item:self:output";

export type EditorItemOriginOperationRequirementContext =
	| {
			readonly clause: "all-of" | "any-of";
			readonly clauseIndex?: number;
			readonly outputRouteId: string;
			readonly requirement: EditorItemOriginRequirementOccurrence;
	  }
	| {
			readonly clause: "unsupported";
			readonly outputRouteId: string;
			readonly requirement: EditorItemOriginUnsupportedRequirementOccurrence;
	  };

interface EditorItemOriginOperationPort {
	readonly id: string;
	readonly itemId: string;
	readonly label: string;
	readonly requirementContexts?: ReadonlyArray<EditorItemOriginOperationRequirementContext>;
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
	readonly requirementContexts?: ReadonlyArray<EditorItemOriginOperationRequirementContext>;
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
