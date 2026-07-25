import type { PixiGridSurfaceLayout } from "~/ui/pixi/layout/PixiSceneLayout";

export interface PixiSceneDropTarget {
	readonly kind: "slot";
	readonly layout: PixiGridSurfaceLayout;
	readonly x: number;
	readonly y: number;
}
