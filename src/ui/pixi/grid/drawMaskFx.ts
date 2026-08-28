import { Effect } from "effect";
import type { Graphics } from "pixi.js";

import { readSurfaceRadiusFx } from "~/ui/pixi/grid/readSurfaceRadiusFx";
import type { PixiGridSurfaceLayout } from "~/ui/pixi/layout/PixiSceneLayout";

export namespace drawMaskFx {
	export interface Props {
		readonly graphics: Graphics;
		readonly surface: PixiGridSurfaceLayout | null;
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
			yield* readSurfaceRadiusFx(surface),
		)
		.fill(0xffffff);
});
