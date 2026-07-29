import { Effect } from "effect";
import type { Graphics } from "pixi.js";

import { readPixiGridSurfaceRadius } from "~/ui/pixi/grid/readPixiGridSurfaceRadius";
import type { PixiGridSurfaceLayout } from "~/ui/pixi/layout/PixiSceneLayout";

const drawRoundedOuterSlotPath = (
	graphics: Graphics,
	surface: PixiGridSurfaceLayout,
	slot: NonNullable<drawPixiGridDropFeedbackFx.Props["slot"]>,
) => {
	const left = surface.x + slot.x * surface.cellSize;
	const top = surface.y + slot.y * surface.cellSize;
	const width = (slot.width ?? 1) * surface.cellSize;
	const height = (slot.height ?? 1) * surface.cellSize;
	const right = left + width;
	const bottom = top + height;
	const radius = readPixiGridSurfaceRadius(surface);
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
		return graphics.rect(left, top, width, height);
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

export namespace drawPixiGridDropFeedbackFx {
	export interface Props {
		readonly color: number;
		readonly graphics: Graphics;
		readonly markers?: ReadonlyArray<{
			readonly color: number;
			readonly slot: NonNullable<Props["slot"]>;
		}>;
		readonly slot: {
			readonly height?: number;
			readonly width?: number;
			readonly x: number;
			readonly y: number;
		} | null;
		readonly surface: PixiGridSurfaceLayout | null;
	}
}

/** Paints one accepted or rejected slot marker without owning preview semantics. */
export const drawPixiGridDropFeedbackFx = Effect.fn("drawPixiGridDropFeedbackFx")(
	({ color, graphics, markers, slot, surface }: drawPixiGridDropFeedbackFx.Props) =>
		Effect.sync(() => {
			graphics.clear();
			if (slot === null || surface === null) return;
			for (const marker of markers ?? [
				{
					color,
					slot,
				},
			]) {
				drawRoundedOuterSlotPath(graphics, surface, marker.slot)
					.fill({
						alpha: 0.16,
						color: marker.color,
					})
					.stroke({
						alpha: 0.95,
						color: marker.color,
						width: Math.max(2, surface.cellSize * 0.025),
					});
			}
		}),
);
