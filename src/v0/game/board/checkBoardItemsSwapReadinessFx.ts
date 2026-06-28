import { Effect } from "effect";
import { readBoardItemRuntimeStateStatus } from "~/v0/game/board/readBoardItemRuntimeStateStatus";
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

		const sourceStatus = readBoardItemRuntimeStateStatus({
			itemInstanceId: source.id,
			save,
		});
		if (sourceStatus.craftBusy) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"item_busy",
					"Board item has a running craft job and cannot be swapped.",
				),
			);
		}

		const targetStatus = readBoardItemRuntimeStateStatus({
			itemInstanceId: target.id,
			save,
		});
		if (targetStatus.craftBusy) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"item_busy",
					"Board item has a running craft job and cannot be swapped.",
				),
			);
		}

		return {
			source,
			target,
		};
	},
);
