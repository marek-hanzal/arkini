import type { PixiGridSurfaceLayout } from "~/ui/pixi/layout/PixiSceneLayout";

/** Keeps every grid-owned outline aligned to the same rounded surface geometry. */
export const readPixiGridSurfaceRadius = (surface: PixiGridSurfaceLayout) =>
	Math.min(16, surface.cellSize * 0.12);
