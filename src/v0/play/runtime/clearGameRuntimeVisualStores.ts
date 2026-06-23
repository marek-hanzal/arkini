import { clearBoardTransientTiles } from "~/v0/board/animation/BoardTransientTileStore";
import { clearTileEngineMotionRequests } from "~/v0/tile-engine/TileEngineMotionRequestStore";

export const clearGameRuntimeVisualStores = () => {
	clearBoardTransientTiles();
	clearTileEngineMotionRequests();
};
