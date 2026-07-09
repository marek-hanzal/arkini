import { match } from "ts-pattern";
import type { BoardMemoryEvent } from "~/play/game-engine-visual/BoardMemoryEvent";
import { appendBoardTileBounceFeedback } from "~/play/game-engine-visual/appendBoardTileBounceFeedback";
import {
	boardMemoryClearedFeedbackDurationMs,
	boardMemoryRestoredFeedbackDurationMs,
	boardMemorySavedFeedbackDurationMs,
} from "~/play/game-engine-visual/boardMemoryFeedbackDurations";
import type { GameEngineVisualPlanContext } from "~/play/game-engine-visual/GameEngineVisualPlanContext";
import { ignoreVisualEvent } from "~/play/game-engine-visual/ignoreVisualEvent";

export const appendBoardMemoryFeedbackEventVisuals = (
	context: GameEngineVisualPlanContext,
	event: BoardMemoryEvent,
) => {
	const feedback = match(event.type)
		.with("board.memory.saved", () => ({
			durationMs: boardMemorySavedFeedbackDurationMs,
			groupId: `engine:memory-saved-feedback:${event.boardItemId}:${event.atMs}`,
			pulseCount: undefined,
		}))
		.with("board.memory.restored", () => ({
			durationMs: boardMemoryRestoredFeedbackDurationMs,
			groupId: `engine:memory-restored-feedback:${event.boardItemId}:${event.atMs}`,
			pulseCount: 2,
		}))
		.with("board.memory.cleared", () => ({
			durationMs: boardMemoryClearedFeedbackDurationMs,
			groupId: `engine:memory-cleared-feedback:${event.boardItemId}:${event.atMs}`,
			pulseCount: undefined,
		}))
		.exhaustive();

	appendBoardTileBounceFeedback({
		durationMs: feedback.durationMs,
		groupId: feedback.groupId,
		plan: context.plan,
		pulseCount: feedback.pulseCount,
		tileId: event.boardItemId,
	});
	ignoreVisualEvent(context, event);
};
