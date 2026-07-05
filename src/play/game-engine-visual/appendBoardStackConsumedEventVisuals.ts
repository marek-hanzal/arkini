import type { GameEventOfType } from "~/event/GameEventOfType";
import { appendBoardStackCreatedVisuals } from "~/play/game-engine-visual/appendBoardStackCreatedVisuals";
import { findBoardStackCreatedEventIndex } from "~/play/game-engine-visual/findBoardStackCreatedEventIndex";
import type { GameEngineVisualPlanContext } from "~/play/game-engine-visual/GameEngineVisualPlanContext";

export const appendBoardStackConsumedEventVisuals = ({
	context,
	event,
	index,
}: {
	context: GameEngineVisualPlanContext;
	event: GameEventOfType<"item.consumed">;
	index: number;
}) => {
	const createdIndex = findBoardStackCreatedEventIndex({
		afterIndex: index,
		events: context.events,
		skipped: context.skipped,
		source: event,
	});
	const created = context.events[createdIndex];
	if (created?.type !== "item.created") return false;

	const handled = appendBoardStackCreatedVisuals({
		currentBoard: context.currentBoard,
		event: created,
		plan: context.plan,
		previousBoard: context.previousBoard,
		sequenceIndex: context.createdSequenceIndex,
		source: event,
	});
	if (!handled) return false;

	context.skipped.add(createdIndex);
	context.createdSequenceIndex += 1;

	return true;
};
