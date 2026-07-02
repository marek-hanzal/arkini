import type { BoardTransientTile } from "~/board/animation/BoardTransientTile";
import type { TileEngineMotionRequest } from "~/tile-engine/TileEngineMotionRequest";

interface GameEngineVisualTransientTilePlan {
	cleanupDelayMs: number;
	groupId: string;
	request: TileEngineMotionRequest;
	tile: BoardTransientTile;
}

export interface GameEngineVisualPlan {
	boardFeedbackRequests: readonly TileEngineMotionRequest[];
	boardEnterRequests: readonly TileEngineMotionRequest[];
	boardTransientTilePlans: readonly GameEngineVisualTransientTilePlan[];
	ignoredEventTypes: readonly string[];
	inventoryEnterRequests: readonly TileEngineMotionRequest[];
}
