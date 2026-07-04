import { Effect } from "effect";
import { removeBoardItemRuntimeStateFx } from "~/board/logic/removeBoardItemRuntimeStateFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import type { GameActionDebugBoardItemDeleteSchema } from "~/action/GameActionDebugBoardItemDeleteSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace deleteDebugBoardItemFx {
	export interface Props {
		action: GameActionDebugBoardItemDeleteSchema.Type;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

export const deleteDebugBoardItemFx = Effect.fn("deleteDebugBoardItemFx")(function* ({
	action,
	config,
	nowMs,
	save,
}: deleteDebugBoardItemFx.Props) {
	const target = save.board.items[action.boardItemId];
	if (!target || target.itemId !== action.expectedItemId) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("invalid_actor", "Debug delete target is stale."),
		);
	}

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	delete nextSave.board.items[target.id];
	yield* removeBoardItemRuntimeStateFx({
		itemInstanceId: target.id,
		save: nextSave,
	});
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			{
				atMs: nowMs,
				itemId: target.itemId,
				itemInstanceId: target.id,
				reason: "debug-delete" as const,
				type: "item.removed" as const,
			},
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
