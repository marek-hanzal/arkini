import { containsPoint } from "~/v0/tile-engine/rect";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";

export const resolveDropAtPoint = <TSlot, TTile, TDrop>(
	drops: ReadonlyMap<string, TileEngineDrop.Registration<TSlot, TTile, TDrop>>,
	x: number,
	y: number,
): TileEngineDrop.Resolved<TSlot, TTile, TDrop> | null => {
	for (const entry of drops.values()) {
		if (!containsPoint(entry.element.getBoundingClientRect(), x, y)) continue;

		return entry;
	}

	return null;
};
