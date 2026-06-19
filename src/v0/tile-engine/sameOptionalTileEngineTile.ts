import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";
import { sameTileEngineTile } from "~/v0/tile-engine/sameTileEngineTile";

export const sameOptionalTileEngineTile = <TTile>(
	left: TileEngine.Tile<TTile> | undefined,
	right: TileEngine.Tile<TTile> | undefined,
) => {
	if (!left || !right) return left === right;

	return sameTileEngineTile(left, right);
};
