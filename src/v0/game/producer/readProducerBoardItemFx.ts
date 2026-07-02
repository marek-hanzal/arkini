import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import { readProducerCapabilityDefinition } from "~/v0/game/config/readProducerCapabilityDefinition";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readProducerBoardItemFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		itemInstanceId: string;
	}
}

export const readProducerBoardItemFx = Effect.fn("readProducerBoardItemFx")(function* ({
	config,
	save,
	itemInstanceId,
}: readProducerBoardItemFx.Props) {
	const boardItem = save.board.items[itemInstanceId];
	if (!boardItem) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Missing board item instance "${itemInstanceId}".`,
			),
		);
	}
	if (
		!readProducerCapabilityDefinition({
			config,
			producerId: boardItem.itemId,
		})
	) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Board item "${itemInstanceId}" is not a producer-like capability.`,
			),
		);
	}
	return boardItem satisfies GameSaveBoardItem;
});
