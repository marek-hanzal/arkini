import { Effect } from "effect";
import { readProducerBoardItemFx } from "~/v0/game/producer/readProducerBoardItemFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerProductLineSetDefault } from "~/v0/game/action/GameActionProducerProductLineSetDefault";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkProducerProductLineSetDefaultReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerProductLineSetDefault;
	}
}

export const checkProducerProductLineSetDefaultReadinessFx = Effect.fn(
	"checkProducerProductLineSetDefaultReadinessFx",
)(function* ({ config, save, action }: checkProducerProductLineSetDefaultReadinessFx.Props) {
	const producerItem = yield* readProducerBoardItemFx({
		config,
		producerItemInstanceId: action.producerItemInstanceId,
		save,
	});
	const producerDefinition =
		config.producers[config.items[producerItem.itemId]?.producerId ?? ""];
	if (!producerDefinition) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Producer item "${producerItem.itemId}" references missing producer.`,
			),
		);
	}
	if (!producerDefinition.productIds.includes(action.productId)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Product "${action.productId}" does not belong to producer "${producerDefinition.type}" on item "${producerItem.itemId}".`,
			),
		);
	}

	return {
		producerDefinition,
		producerItem,
	};
});
