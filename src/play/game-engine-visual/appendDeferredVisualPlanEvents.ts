import { appendRemovedBoardItemVisuals } from "~/play/game-engine-visual/appendRemovedBoardItemVisuals";
import type { GameEngineVisualPlanContext } from "~/play/game-engine-visual/GameEngineVisualPlanContext";

export const appendDeferredVisualPlanEvents = (context: GameEngineVisualPlanContext) => {
	for (const event of context.deferredStashDepletionRemovals) {
		appendRemovedBoardItemVisuals({
			currentBoard: context.currentBoard,
			event,
			plan: context.plan,
			previousBoard: context.previousBoard,
		});
	}
};
