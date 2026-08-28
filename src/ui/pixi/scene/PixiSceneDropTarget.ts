import type { SurfaceLayout } from "~/ui/pixi/layout/SceneLayout";

export interface PixiSceneDropTarget {
	readonly kind: "slot";
	readonly layout: SurfaceLayout;
	readonly x: number;
	readonly y: number;
}
