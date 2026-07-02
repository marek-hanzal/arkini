import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameActionBoardItemMoveSchema } from "~/action/GameActionBoardItemMoveSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";

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
