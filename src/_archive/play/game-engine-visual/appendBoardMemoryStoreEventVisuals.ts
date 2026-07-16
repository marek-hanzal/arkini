import type { GameEventOfType } from "~/event/GameEventOfType";
import { appendBoardMemoryStoreVisuals } from "~/play/game-engine-visual/appendBoardMemoryStoreVisuals";
import type { GameEngineVisualPlanContext } from "~/play/game-engine-visual/GameEngineVisualPlanContext";

export const appendBoardMemoryStoreEventVisuals = (
	context: GameEngineVisualPlanContext,
	event: GameEventOfType<"item.consumed">,
) => {
	const transientTileId = appendBoardMemoryStoreVisuals({
		event,
		memoryItemInstanceId: context.boardMemoryItemInstanceId,
		plan: context.plan,
		previousBoard: context.previousBoard,
		sequenceIndex: context.createdSequenceIndex,
	});
	if (
		event.from.kind === "board" &&
		event.from.itemInstanceId === context.boardMemoryItemInstanceId
	) {
		context.memoryRestoreOriginTileId = transientTileId ?? event.from.itemInstanceId;
	}
	context.createdSequenceIndex += 1;
};
