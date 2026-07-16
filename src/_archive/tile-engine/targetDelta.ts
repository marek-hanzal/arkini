import { rectCenter } from "~/tile-engine/rect";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export const targetDelta = ({
	origin,
	target,
}: {
	origin: TileEngine.Rect;
	target: TileEngine.Rect;
}) => {
	const originCenter = rectCenter(origin);
	const targetCenter = rectCenter(target);

	return {
		x: targetCenter.x - originCenter.x,
		y: targetCenter.y - originCenter.y,
	};
};
