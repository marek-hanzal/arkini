import type { EditorItemOriginItemNode } from "~/editor/origin-flow/EditorItemOriginFlow";

export interface LayoutInput {
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

export interface LayoutNode {
	readonly flowOrder: number;
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

export interface LayoutPoint {
	readonly x: number;
	readonly y: number;
}

export interface Layout {
	/** Orthogonal port-to-port routes snapped onto shared routing tracks. */
	readonly backbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
	readonly positions: ReadonlyMap<string, LayoutNode>;
}
