import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
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
	if (action.x >= config.game.board.width || action.y >= config.game.board.height) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("unsupported_target", "Board cell is outside board."),
		);
	}

	const item = save.board.items[action.boardItemId];
	if (!item) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("invalid_actor", "Board item does not exist."),
		);
	}

	const occupied = Object.values(save.board.items).find(
		(entry) => entry.id !== item.id && entry.x === action.x && entry.y === action.y,
	);
	if (occupied) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("unsupported_target", "Board cell is occupied."),
		);
	}

	const nextSave = yield* cloneGameSaveFx({ save });
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
		nextWakeAtMs: yield* readNextWakeAtMsFx({ save: nextSave }),
		save: nextSave,
	} satisfies GameEngineResult;
});
