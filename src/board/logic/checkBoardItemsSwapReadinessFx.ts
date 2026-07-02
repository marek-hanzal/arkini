import { Effect } from "effect";
import type { GameActionBoardItemsSwapSchema } from "~/action/GameActionBoardItemsSwapSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";

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

		return {
			source,
			target,
		};
	},
);
