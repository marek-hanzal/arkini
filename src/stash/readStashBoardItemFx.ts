import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";

export namespace readStashBoardItemFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		stashItemInstanceId: string;
	}
}

export const readStashBoardItemFx = Effect.fn("readStashBoardItemFx")(function* ({
	config,
	save,
	stashItemInstanceId,
}: readStashBoardItemFx.Props) {
	const boardItem = save.board.items[stashItemInstanceId];
	if (!boardItem) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Missing board item instance "${stashItemInstanceId}".`,
			),
		);
	}
	if (!config.items[boardItem.itemId]?.stash) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Board item "${stashItemInstanceId}" is not a stash.`,
			),
		);
	}
	return boardItem satisfies GameSaveBoardItem;
});
