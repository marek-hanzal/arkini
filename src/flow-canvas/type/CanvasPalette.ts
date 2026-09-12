import type { ItemOriginOperationKind } from "~/flow/type/ItemOriginFlow";

export interface CanvasPalette {
	readonly accent: string;
	readonly canvas: string;
	readonly danger: string;
	readonly foreground: string;
	readonly info: string;
	readonly itemSurface: string;
	readonly missingItemSurface: string;
	readonly line: string;
	readonly lineStrong: string;
	readonly muted: string;
	readonly sourceSurfaces: Readonly<Record<ItemOriginOperationKind, string>>;
	readonly success: string;
	readonly warning: string;
}
