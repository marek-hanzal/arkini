import type { GameEventOfType } from "~/event/GameEventOfType";
import { appendBoardMemoryRestoreVisuals } from "~/play/game-engine-visual/appendBoardMemoryRestoreVisuals";
import { appendItemCreatedVisuals } from "~/play/game-engine-visual/appendItemCreatedVisuals";
import type { GameEngineVisualPlanContext } from "~/play/game-engine-visual/GameEngineVisualPlanContext";

export const appendItemCreatedEventVisuals = (
	context: GameEngineVisualPlanContext,
	event: GameEventOfType<"item.created">,
) => {
	if (event.reason === "memory-restore") {
		appendBoardMemoryRestoreVisuals({
			currentBoard: context.currentBoard,
			event,
			plan: context.plan,
			restoreOriginTileId: context.memoryRestoreOriginTileId,
			sequenceIndex: context.memoryRestoreSequenceIndex,
		});
		context.memoryRestoreSequenceIndex += 1;
		return;
	}

	const sequenceIndex = event.spawnSequenceIndex ?? context.createdSequenceIndex;
	appendItemCreatedVisuals({
		currentBoard: context.currentBoard,
		currentInventory: context.currentInventory,
		event,
		previousBoard: context.previousBoard,
		plan: context.plan,
		sequenceIndex,
	});
	context.createdSequenceIndex = Math.max(context.createdSequenceIndex + 1, sequenceIndex + 1);
};
