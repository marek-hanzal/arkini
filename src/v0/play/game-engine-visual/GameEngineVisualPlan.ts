import type { BoardTransientTile } from "~/v0/board/animation/BoardTransientTile";
import type { TileEngineMotionRequest } from "~/v0/tile-engine";

export interface GameEngineVisualTransientTilePlan {
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
