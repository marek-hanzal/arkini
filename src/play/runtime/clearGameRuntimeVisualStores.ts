import { clearBoardTransientTiles } from "~/board/animation/BoardTransientTileStore";
import { clearTileEngineMotionRequests } from "~/tile-engine";

export const clearGameRuntimeVisualStores = () => {
	clearBoardTransientTiles();
	clearTileEngineMotionRequests();
};
