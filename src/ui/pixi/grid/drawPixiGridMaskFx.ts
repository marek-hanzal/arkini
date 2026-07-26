import { Effect } from "effect";
import type { Graphics } from "pixi.js";

import { readPixiGridSurfaceRadius } from "~/ui/pixi/grid/readPixiGridSurfaceRadius";
import type { PixiGridSurfaceLayout } from "~/ui/pixi/layout/PixiSceneLayout";

export namespace drawPixiGridMaskFx {
	export interface Props {
		readonly graphics: Graphics;
		readonly surface: PixiGridSurfaceLayout | null;
	}
}

/** Paints one rounded grid mask without retaining its surface geometry. */
export const drawPixiGridMaskFx = Effect.fn("drawPixiGridMaskFx")(
	({ graphics, surface }: drawPixiGridMaskFx.Props) =>
		Effect.sync(() => {
			graphics.clear();
			if (surface === null) return;
			graphics
				.roundRect(
					surface.x,
					surface.y,
					surface.width,
					surface.height,
					readPixiGridSurfaceRadius(surface),
				)
				.fill(0xffffff);
		}),
);
