import { Effect } from "effect";

import type { PixiGridSurfaceLayout } from "~/ui/pixi/layout/PixiSceneLayout";

/** Keeps every grid-owned outline aligned to the same rounded surface geometry. */
export const readSurfaceRadiusFx = Effect.fnUntraced(function* (surface: PixiGridSurfaceLayout) {
	return Math.min(16, surface.cellSize * 0.12);
});
