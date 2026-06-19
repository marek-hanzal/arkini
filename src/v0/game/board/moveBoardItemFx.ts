import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { checkBoardItemMoveReadinessFx } from "~/v0/game/board/checkBoardItemMoveReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import type { GameActionBoardItemMoveSchema } from "~/v0/game/engine/model/GameActionBoardItemMoveSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

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

	return {
		events: [],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
