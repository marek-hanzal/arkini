import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import { readProducerCapabilityDefinition } from "~/v0/game/config/readProducerCapabilityDefinition";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readProducerBoardItemFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		producerItemInstanceId: string;
	}
}

export const readProducerBoardItemFx = Effect.fn("readProducerBoardItemFx")(function* ({
	config,
	save,
	producerItemInstanceId,
}: readProducerBoardItemFx.Props) {
	const boardItem = save.board.items[producerItemInstanceId];
	if (!boardItem) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Missing board item instance "${producerItemInstanceId}".`,
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
				`Board item "${producerItemInstanceId}" is not a producer-like capability.`,
			),
		);
	}
	return boardItem satisfies GameSaveBoardItem;
});
