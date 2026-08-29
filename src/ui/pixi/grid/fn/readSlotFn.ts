import type { SurfaceLayout } from "~/ui/pixi/layout/SceneLayout";

export namespace readSlotFn {
	export interface Props {
		readonly surface: SurfaceLayout | null;
		readonly x: number;
		readonly y: number;
	}

	export interface Result {
		readonly x: number;
		readonly y: number;
	}
}

/** Resolves viewport coordinates to one clamped slot on the supplied grid. */
export const readSlotFn = ({ surface, x, y }: readSlotFn.Props): readSlotFn.Result | null => {
	if (
		surface === null ||
		x < surface.x ||
		x > surface.x + surface.width ||
		y < surface.y ||
		y > surface.y + surface.height
	) {
		return null;
	}
	const slotX = Math.min(surface.columns - 1, Math.floor((x - surface.x) / surface.cellSize));
	const slotY = Math.min(surface.rows - 1, Math.floor((y - surface.y) / surface.cellSize));
	if (slotX < 0 || slotY < 0) return null;
	return {
		x: slotX,
		y: slotY,
	};
};
