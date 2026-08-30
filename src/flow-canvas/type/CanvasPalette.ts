import type {
	EditorItemOriginItemNode,
	EditorItemOriginOperationKind,
} from "~/flow/type/EditorItemOriginFlow";

export interface CanvasPalette {
	readonly accent: string;
	readonly canvas: string;
	readonly danger: string;
	readonly foreground: string;
	readonly info: string;
	readonly itemSurfaces: Readonly<Record<EditorItemOriginItemNode["type"], string>>;
	readonly line: string;
	readonly lineStrong: string;
	readonly muted: string;
	readonly sourceSurfaces: Readonly<Record<EditorItemOriginOperationKind, string>>;
	readonly success: string;
	readonly warning: string;
}
