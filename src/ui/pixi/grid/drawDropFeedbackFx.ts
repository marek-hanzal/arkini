import { Effect } from "effect";
import type { Graphics } from "pixi.js";

import { readSurfaceRadiusFx } from "~/ui/pixi/grid/readSurfaceRadiusFx";
import type { PixiGridSurfaceLayout } from "~/ui/pixi/layout/PixiSceneLayout";

const drawRoundedOuterSlotPath = (
	graphics: Graphics,
	surface: PixiGridSurfaceLayout,
	slot: NonNullable<drawDropFeedbackFx.Props["slot"]>,
	radius: number,
) => {
	const left = surface.x + slot.x * surface.cellSize;
	const top = surface.y + slot.y * surface.cellSize;
	const right = left + surface.cellSize;
	const bottom = top + surface.cellSize;
	const isLeft = slot.x === 0;
	const isRight = slot.x === surface.columns - 1;
	const isTop = slot.y === 0;
	const isBottom = slot.y === surface.rows - 1;
	const topLeftRadius = isTop && isLeft ? radius : 0;
	const topRightRadius = isTop && isRight ? radius : 0;
	const bottomRightRadius = isBottom && isRight ? radius : 0;
	const bottomLeftRadius = isBottom && isLeft ? radius : 0;

	if (
		topLeftRadius === 0 &&
		topRightRadius === 0 &&
		bottomRightRadius === 0 &&
		bottomLeftRadius === 0
	) {
		return graphics.rect(left, top, surface.cellSize, surface.cellSize);
	}

	return graphics
		.moveTo(left + topLeftRadius, top)
		.lineTo(right - topRightRadius, top)
		.quadraticCurveTo(right, top, right, top + topRightRadius)
		.lineTo(right, bottom - bottomRightRadius)
		.quadraticCurveTo(right, bottom, right - bottomRightRadius, bottom)
		.lineTo(left + bottomLeftRadius, bottom)
		.quadraticCurveTo(left, bottom, left, bottom - bottomLeftRadius)
		.lineTo(left, top + topLeftRadius)
		.quadraticCurveTo(left, top, left + topLeftRadius, top)
		.closePath();
};

export namespace drawDropFeedbackFx {
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
export const drawDropFeedbackFx = Effect.fn("drawDropFeedbackFx")(function* ({
	color,
	graphics,
	slot,
	surface,
}: drawDropFeedbackFx.Props) {
	graphics.clear();
	if (slot === null || surface === null) return;
	const radius = yield* readSurfaceRadiusFx(surface);
	drawRoundedOuterSlotPath(graphics, surface, slot, radius)
		.fill({
			alpha: 0.16,
			color,
		})
		.stroke({
			alpha: 0.95,
			color,
			width: Math.max(2, surface.cellSize * 0.025),
		});
});
