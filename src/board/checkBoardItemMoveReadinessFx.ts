import { Effect } from "effect";
import type { GameActionBoardItemMoveSchema } from "~/action/GameActionBoardItemMoveSchema";
import { assertBoardCellInsideBoundsFx } from "~/board/assertBoardCellInsideBoundsFx";
import { readBoardItemAtCellFx } from "~/board/readBoardItemAtCellFx";
import type { GameConfig } from "~/config/GameConfigTypes";
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
	yield* assertBoardCellInsideBoundsFx({
		config,
		x: action.x,
		y: action.y,
	});

	const item = save.board.items[action.boardItemId];
	if (!item) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("invalid_actor", "Board item does not exist."),
		);
	}

	if (item.x === action.x && item.y === action.y) return item;

	const occupied = yield* readBoardItemAtCellFx({
		ignoredBoardItemInstanceIds: new Set([
			item.id,
		]),
		save,
		x: action.x,
		y: action.y,
	});
	if (occupied) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("unsupported_target", "Board cell is occupied."),
		);
	}

	return item;
});
