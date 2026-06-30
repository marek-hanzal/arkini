import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace readTileEngineSlotVisibleFeedback {
	export interface Props<TTile = unknown> {
		dropFeedback: TileEngine.ActiveDropFeedback | null;
		targetTile: TileEngine.Tile<TTile> | undefined;
	}
}

export const readTileEngineSlotVisibleFeedback = <TTile>({
	dropFeedback,
	targetTile,
}: readTileEngineSlotVisibleFeedback.Props<TTile>): TileEngine.ActiveDropFeedback | null => {
	if (!dropFeedback) return null;
	if (targetTile) return null;

	return dropFeedback;
};
