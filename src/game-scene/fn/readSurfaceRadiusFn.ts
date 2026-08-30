import type { SurfaceLayout } from "~/game-scene/type/SceneLayout";

/** Keeps every grid-owned outline aligned to the same rounded surface geometry. */
export const readSurfaceRadiusFn = (surface: SurfaceLayout) =>
	Math.min(16, surface.cellSize * 0.12);
