import { Effect } from "effect";
import type { Graphics } from "pixi.js";

import type { PixiGridSurfaceLayout } from "~/ui/pixi/layout/PixiSceneLayout";

export namespace drawPixiGridDropFeedbackFx {
	export interface Props {
		readonly color: number;
		readonly graphics: Graphics;
		readonly slot: {
			readonly x: number;
			readonly y: number;
		} | null;
		readonly surface: PixiGridSurfaceLayout | null;
	}
}

/** Paints one accepted or rejected slot marker without owning preview semantics. */
export const drawPixiGridDropFeedbackFx = Effect.fn("drawPixiGridDropFeedbackFx")(
	({ color, graphics, slot, surface }: drawPixiGridDropFeedbackFx.Props) =>
		Effect.sync(() => {
			graphics.clear();
			if (slot === null || surface === null) return;
			graphics
				.rect(
					surface.x + slot.x * surface.cellSize,
					surface.y + slot.y * surface.cellSize,
					surface.cellSize,
					surface.cellSize,
				)
				.fill({
					alpha: 0.16,
					color,
				})
				.stroke({
					alpha: 0.95,
					color,
					width: Math.max(2, surface.cellSize * 0.025),
				});
		}),
);
