import type { PixiGridSurfaceLayout } from "~/ui/pixi/layout/PixiSceneLayout";

export interface PixiSceneDropTarget {
	readonly kind: "slot";
	readonly layout: PixiGridSurfaceLayout;
	/** Cell under the pointer; distinct from the requested item anchor. */
	readonly hitX: number;
	readonly hitY: number;
	/** Requested top-left anchor after applying the grab-local cell offset. */
	readonly x: number;
	readonly y: number;
}
