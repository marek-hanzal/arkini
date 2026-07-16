import type { GameEventOfType } from "~/event/GameEventOfType";
import { appendBoardTileBounceFeedback } from "~/play/game-engine-visual/appendBoardTileBounceFeedback";
import { capacityTapFeedbackDurationMs } from "~/play/game-engine-visual/capacityTapFeedbackDurationMs";
import type { GameEngineVisualPlanContext } from "~/play/game-engine-visual/GameEngineVisualPlanContext";
import { ignoreVisualEvent } from "~/play/game-engine-visual/ignoreVisualEvent";

export const appendItemCapacityChangedEventVisuals = (
	context: GameEngineVisualPlanContext,
	event: GameEventOfType<"item.capacity.changed">,
) => {
	const sourceTile =
		context.currentBoard?.byId[event.itemInstanceId] ??
		context.previousBoard?.byId[event.itemInstanceId];
	if (!sourceTile) {
		ignoreVisualEvent(context, event);
		return;
	}

	appendBoardTileBounceFeedback({
		durationMs: capacityTapFeedbackDurationMs,
		groupId: `engine:capacity-tap:${event.itemInstanceId}:${event.atMs}`,
		plan: context.plan,
		tileId: event.itemInstanceId,
	});
	ignoreVisualEvent(context, event);
};
