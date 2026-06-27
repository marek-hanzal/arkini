import { Effect } from "effect";
import { checkBoardItemIdleFx } from "~/v0/game/board/checkBoardItemIdleFx";
import type { GameActionBoardItemsSwapSchema } from "~/v0/game/action/GameActionBoardItemsSwapSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkBoardItemsSwapReadinessFx {
	export interface Props {
		action: GameActionBoardItemsSwapSchema.Type;
		save: GameSave;
	}
}

export const checkBoardItemsSwapReadinessFx = Effect.fn("checkBoardItemsSwapReadinessFx")(
	function* ({ action, save }: checkBoardItemsSwapReadinessFx.Props) {
		if (action.sourceBoardItemId === action.targetBoardItemId) {
			return {
				source: save.board.items[action.sourceBoardItemId],
				target: save.board.items[action.targetBoardItemId],
			};
		}

		const source = save.board.items[action.sourceBoardItemId];
		const target = save.board.items[action.targetBoardItemId];
		if (!source || !target) {
			return yield* Effect.fail(
				GameEngineError.actionRejected("invalid_actor", "Both board items must exist."),
			);
		}

		yield* checkBoardItemIdleFx({
			itemInstanceId: source.id,
			message: "Board item has a running job and cannot be swapped.",
			save,
		});
		yield* checkBoardItemIdleFx({
			itemInstanceId: target.id,
			message: "Board item has a running job and cannot be swapped.",
			save,
		});

		return {
			source,
			target,
		};
	},
);
