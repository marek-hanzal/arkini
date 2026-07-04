import { Effect } from "effect";
import { removeBoardItemFromSaveFx } from "~/board/removeBoardItemFromSaveFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import type { GameActionDebugBoardItemDeleteSchema } from "~/action/GameActionDebugBoardItemDeleteSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
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
	yield* removeBoardItemFromSaveFx({
		itemInstanceId: target.id,
		runtimeState: "remove",
		save: nextSave,
	});
	nextSave.updatedAtMs = nowMs;

	return yield* createGameEngineResultFx({
		config,
		events: [
			{
				atMs: nowMs,
				itemId: target.itemId,
				itemInstanceId: target.id,
				reason: "debug-delete" as const,
				type: "item.removed" as const,
			},
		],
		nowMs,
		save: nextSave,
	});
});
