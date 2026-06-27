import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionBoardItemMoveSchema } from "~/v0/game/action/GameActionBoardItemMoveSchema";
import { checkBoardItemIdleFx } from "~/v0/game/board/checkBoardItemIdleFx";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkBoardItemMoveReadinessFx {
	export interface Props {
		action: GameActionBoardItemMoveSchema.Type;
		config: GameConfig;
		save: GameSave;
	}
}

export const checkBoardItemMoveReadinessFx = Effect.fn("checkBoardItemMoveReadinessFx")(function* ({
	action,
	config,
	save,
}: checkBoardItemMoveReadinessFx.Props) {
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

	if (item.x === action.x && item.y === action.y) return item;

	yield* checkBoardItemIdleFx({
		itemInstanceId: item.id,
		message: "Board item has a running job and cannot be moved.",
		save,
	});

	const occupied = Object.values(save.board.items).find(
		(entry) => entry.id !== item.id && entry.x === action.x && entry.y === action.y,
	);
	if (occupied) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("unsupported_target", "Board cell is occupied."),
		);
	}

	return item;
});
