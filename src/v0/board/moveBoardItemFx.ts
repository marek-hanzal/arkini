import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { checkBoardItemMoveReadinessFx } from "~/board/checkBoardItemMoveReadinessFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import type { GameActionBoardItemMoveSchema } from "~/action/GameActionBoardItemMoveSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace moveBoardItemFx {
	export interface Props {
		action: GameActionBoardItemMoveSchema.Type;
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

export const moveBoardItemFx = Effect.fn("moveBoardItemFx")(function* ({
	action,
	config,
	save,
	nowMs,
}: moveBoardItemFx.Props) {
	const item = yield* checkBoardItemMoveReadinessFx({
		action,
		config,
		save,
	});

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const liveItem = nextSave.board.items[item.id];
	if (!liveItem) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("invalid_actor", "Board item disappeared."),
		);
	}

	liveItem.x = action.x;
	liveItem.y = action.y;
	nextSave.updatedAtMs = nowMs;

	return yield* createGameEngineResultFx({
		config,
		events: [],
		nowMs,
		save: nextSave,
	});
});
