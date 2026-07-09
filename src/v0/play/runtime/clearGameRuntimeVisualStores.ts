import { clearBoardTransientTiles } from "~/board/animation/BoardTransientTileStore";
import { clearTileEngineMotionRequests } from "~/tile-engine/TileEngineMotionRequestStore";

export const clearGameRuntimeVisualStores = () => {
	clearBoardTransientTiles();
	clearTileEngineMotionRequests();
};
