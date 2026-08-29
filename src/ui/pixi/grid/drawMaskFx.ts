import { Effect } from "effect";
import type { Graphics } from "pixi.js";

import { readSurfaceRadiusFn } from "~/ui/pixi/grid/fn/readSurfaceRadiusFn";
import type { SurfaceLayout } from "~/ui/pixi/layout/SceneLayout";

export namespace drawMaskFx {
	export interface Props {
		readonly graphics: Graphics;
		readonly surface: SurfaceLayout | null;
	}
}

/** Paints one rounded grid mask without retaining its surface geometry. */
export const drawMaskFx = Effect.fn("drawMaskFx")(function* ({
	graphics,
	surface,
}: drawMaskFx.Props) {
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
