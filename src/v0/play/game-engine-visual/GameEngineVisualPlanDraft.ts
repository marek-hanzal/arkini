import type { GameEngineVisualPlan } from "~/v0/play/game-engine-visual/GameEngineVisualPlan";
import type { TileEngineMotionRequest } from "~/v0/tile-engine";

export interface GameEngineVisualPlanDraft {
	boardEnterRequests: TileEngineMotionRequest[];
	boardTransientTilePlans: GameEngineVisualPlan["boardTransientTilePlans"] extends readonly (infer T)[]
		? T[]
		: never;
	ignoredEventTypes: string[];
	inventoryEnterRequests: TileEngineMotionRequest[];
}

export const createGameEngineVisualPlanDraft = (): GameEngineVisualPlanDraft => ({
	boardEnterRequests: [],
	boardTransientTilePlans: [],
	ignoredEventTypes: [],
	inventoryEnterRequests: [],
});
