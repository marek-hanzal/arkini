import type { GameEngineVisualPlan } from "~/v0/play/game-engine-visual/GameEngineVisualPlan";

export const summarizeGameEngineVisualPlan = (plan: GameEngineVisualPlan) => ({
	boardEnterRequests: plan.boardEnterRequests.length,
	boardFeedbackRequests: plan.boardFeedbackRequests.length,
	boardTransientTiles: plan.boardTransientTilePlans.length,
	ignoredEventTypes: plan.ignoredEventTypes,
	inventoryEnterRequests: plan.inventoryEnterRequests.length,
});
