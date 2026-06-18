import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

const sameTileData = <TTile>(left: TileEngine.Tile<TTile>, right: TileEngine.Tile<TTile>) => {
	if (left.renderKey !== undefined || right.renderKey !== undefined) {
		return left.renderKey === right.renderKey;
	}

	return Object.is(left.data, right.data);
};

/**
 * Shallow identity check for memoized TileEngine actor props.
 *
 * `renderKey` lets adapters opt into scalar equality for tile renderer data
 * without forcing every derived snapshot update to recreate/mount actors.
 */
export const sameTileEngineTile = <TTile>(
	left: TileEngine.Tile<TTile>,
	right: TileEngine.Tile<TTile>,
) =>
	left.id === right.id &&
	left.slotId === right.slotId &&
	left.hidden === right.hidden &&
	left.disabled === right.disabled &&
	left.style === right.style &&
	sameTileData(left, right);
