import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace clampDragDelta {
	export interface Props {
		x: number;
		y: number;
		origin: TileEngine.Rect;
		bounds: TileEngine.Rect | null;
	}
}

export const clampDragDelta = ({ x, y, origin, bounds }: clampDragDelta.Props) => {
	if (!bounds) {
		return {
			x,
			y,
		};
	}

	const minX = bounds.left - origin.left;
	const maxX = bounds.left + bounds.width - (origin.left + origin.width);
	const minY = bounds.top - origin.top;
	const maxY = bounds.top + bounds.height - (origin.top + origin.height);

	return {
		x: Math.min(maxX, Math.max(minX, x)),
		y: Math.min(maxY, Math.max(minY, y)),
	};
};
