import { Effect } from "effect";
import type { Graphics } from "pixi.js";

import { readSurfaceRadiusFn } from "~/game-scene/fn/readSurfaceRadiusFn";
import type { SurfaceLayout } from "~/game-scene/type/SceneLayout";

interface DrawMaskProps {
	readonly graphics: Graphics;
	readonly surface: SurfaceLayout | null;
}

/** Paints one rounded grid mask without retaining its surface geometry. */
export const drawMaskFx = Effect.fn("drawMaskFx")(function* ({ graphics, surface }: DrawMaskProps) {
	graphics.clear();
	if (surface === null) return;
	graphics
		.roundRect(
			surface.x,
			surface.y,
			surface.width,
			surface.height,
			readSurfaceRadiusFn(surface),
		)
		.fill(0xffffff);
});
