import type { GameEngineVisualPlan } from "~/play/game-engine-visual/GameEngineVisualPlan";
import type { TileEngineMotionRequest } from "~/tile-engine/TileEngineMotionRequest";

export interface GameEngineVisualPlanDraft {
	boardFeedbackRequests: TileEngineMotionRequest[];
	boardEnterRequests: TileEngineMotionRequest[];
	boardTransientTilePlans: GameEngineVisualPlan["boardTransientTilePlans"] extends readonly (infer T)[]
		? T[]
		: never;
	ignoredEventTypes: string[];
	inventoryEnterRequests: TileEngineMotionRequest[];
}

export const createGameEngineVisualPlanDraft = (): GameEngineVisualPlanDraft => ({
	boardFeedbackRequests: [],
	boardEnterRequests: [],
	boardTransientTilePlans: [],
	ignoredEventTypes: [],
	inventoryEnterRequests: [],
});
