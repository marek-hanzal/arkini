import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";

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
	const item = config.items[boardItem.itemId];
	if (!item?.stashId) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Board item "${stashItemInstanceId}" is not a stash.`,
			),
		);
	}
	return boardItem satisfies GameSaveBoardItem;
});
