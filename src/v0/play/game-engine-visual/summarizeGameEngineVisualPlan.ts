import type { GameEngineVisualPlan } from "~/v0/play/game-engine-visual/GameEngineVisualPlan";

export const summarizeGameEngineVisualPlan = (plan: GameEngineVisualPlan) => ({
	boardEnterRequests: plan.boardEnterRequests.length,
	boardTransientTiles: plan.boardTransientTilePlans.length,
	ignoredEventTypes: plan.ignoredEventTypes,
	inventoryEnterRequests: plan.inventoryEnterRequests.length,
});
