import { Effect } from "effect";
import type { Graphics } from "pixi.js";

import type { PixiGridSurfaceLayout } from "~/ui/pixi/layout/PixiSceneLayout";

export namespace drawPixiGridSurfaceFx {
	export interface Props {
		readonly graphics: Graphics;
		readonly lineColor: number;
		readonly slotColors: readonly [
			number,
			number,
		];
		readonly surface: PixiGridSurfaceLayout | null;
		readonly surfaceColor: number;
	}
}

/** Paints one checkerboard grid without retaining layout or palette state. */
export const drawPixiGridSurfaceFx = Effect.fn("drawPixiGridSurfaceFx")(
	({ graphics, lineColor, slotColors, surface, surfaceColor }: drawPixiGridSurfaceFx.Props) =>
		Effect.sync(() => {
			graphics.clear();
			if (surface === null) {
				graphics.visible = false;
				return;
			}
			graphics.visible = true;
			const radius = Math.min(16, surface.cellSize * 0.12);
			graphics.roundRect(surface.x, surface.y, surface.width, surface.height, radius).fill({
				alpha: 0.78,
				color: surfaceColor,
			});
			for (let y = 0; y < surface.rows; y += 1) {
				for (let x = 0; x < surface.columns; x += 1) {
					graphics
						.rect(
							surface.x + x * surface.cellSize,
							surface.y + y * surface.cellSize,
							surface.cellSize,
							surface.cellSize,
						)
						.fill({
							alpha: 0.92,
							color: slotColors[(x + y) % 2],
						})
						.stroke({
							alpha: 0.55,
							color: lineColor,
							width: 1,
						});
				}
			}
			graphics.roundRect(surface.x, surface.y, surface.width, surface.height, radius).stroke({
				color: lineColor,
				width: 1,
			});
		}),
);
