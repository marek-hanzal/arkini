import type { EditorItemOriginItemNode } from "~/bridge/item/editor/EditorItemOriginFlow";

export interface EditorItemOriginFlowLayoutInput {
	readonly edges: ReadonlyArray<{
		readonly id: string;
		readonly source: string;
		readonly sourcePortId?: string;
		readonly target: string;
		readonly targetPortId?: string;
	}>;
	readonly nodes: ReadonlyArray<{
		readonly height: number;
		readonly id: string;
		readonly ports: ReadonlyArray<{
			readonly id: string;
			readonly x: number;
			readonly y: number;
		}>;
		readonly type: EditorItemOriginItemNode["type"];
		readonly width: number;
	}>;
}

export interface EditorItemOriginFlowLayoutNode {
	readonly flowOrder: number;
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

export interface EditorItemOriginFlowLayoutPoint {
	readonly x: number;
	readonly y: number;
}

export interface EditorItemOriginFlowLayout {
	/** Orthogonal port-to-port routes snapped onto shared routing tracks. */
	readonly backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
	readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
}
