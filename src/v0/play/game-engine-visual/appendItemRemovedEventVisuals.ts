import type { GameEventOfType } from "~/event/GameEventOfType";
import { appendRemovedBoardItemVisuals } from "~/play/game-engine-visual/appendRemovedBoardItemVisuals";
import type { GameEngineVisualPlanContext } from "~/play/game-engine-visual/GameEngineVisualPlanContext";
import { ignoreVisualEvent } from "~/play/game-engine-visual/ignoreVisualEvent";

export const appendItemRemovedEventVisuals = (
	context: GameEngineVisualPlanContext,
	event: GameEventOfType<"item.removed">,
) => {
	if (event.reason === "producer-depleted") {
		context.deferredStashDepletionRemovals.push(event);
	} else if (event.reason !== "debug-delete") {
		appendRemovedBoardItemVisuals({
			currentBoard: context.currentBoard,
			event,
			plan: context.plan,
			previousBoard: context.previousBoard,
		});
	}
	ignoreVisualEvent(context, event);
};
