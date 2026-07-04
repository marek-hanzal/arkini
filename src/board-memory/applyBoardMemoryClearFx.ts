import { Effect } from "effect";
import { removeBoardMemoryLayoutFromSaveFx } from "~/board-memory/removeBoardMemoryLayoutFromSaveFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameActionBoardMemoryClearSchema } from "~/action/GameActionBoardMemoryClearSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace applyBoardMemoryClearFx {
	export interface Props {
		action: GameActionBoardMemoryClearSchema.Type;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

export const applyBoardMemoryClearFx = Effect.fn("applyBoardMemoryClearFx")(function* ({
	action,
	config,
	nowMs,
	save,
}: applyBoardMemoryClearFx.Props) {
	const boardItem = save.board.items[action.boardItemId];
	if (!boardItem || boardItem.itemId !== boardMemoryItemId) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("invalid_actor", "Board memory item does not exist."),
		);
	}

	const previous = save.boardMemoryLayouts[action.boardItemId];
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	yield* removeBoardMemoryLayoutFromSaveFx({
		boardItemId: action.boardItemId,
		save: nextSave,
	});
	nextSave.updatedAtMs = nowMs;

	const events: GameEvent[] = previous
		? [
				{
					atMs: nowMs,
					boardItemId: action.boardItemId,
					itemCount: previous.items.length,
					type: "board.memory.cleared",
				},
			]
		: [];

	return yield* createGameEngineResultFx({
		config,
		events,
		nowMs,
		save: nextSave,
	});
});
