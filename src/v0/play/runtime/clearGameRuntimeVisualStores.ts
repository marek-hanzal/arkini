import { clearBoardTransientTiles } from "~/v0/board/animation/BoardTransientTileStore";
import { clearTileEngineMotionRequests } from "~/v0/tile-engine";

export const clearGameRuntimeVisualStores = () => {
	clearBoardTransientTiles();
	clearTileEngineMotionRequests();
};
