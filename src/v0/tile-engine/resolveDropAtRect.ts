import { rectCenter } from "~/v0/tile-engine/rect";
import { resolveDropAtPoint } from "~/v0/tile-engine/resolveDropAtPoint";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export const resolveDropAtRect = <TSlot, TTile, TDrop>(
	drops: ReadonlyMap<string, TileEngineDrop.Registration<TSlot, TTile, TDrop>>,
	rect: TileEngine.Rect,
): TileEngineDrop.Resolved<TSlot, TTile, TDrop> | null => {
	const center = rectCenter(rect);
	return resolveDropAtPoint(drops, center.x, center.y);
};
