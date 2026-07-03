import { Effect } from "effect";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameActionBoardMemoryClearSchema } from "~/action/GameActionBoardMemoryClearSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
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
	delete nextSave.boardMemoryLayouts[action.boardItemId];
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

	return {
		events,
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
