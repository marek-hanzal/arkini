import { Effect } from "effect";
import { readProducerBoardItemFx } from "~/v0/game/engine/fx/readProducerBoardItemFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerProductLineSetEnabled } from "~/v0/game/engine/model/GameActionProducerProductLineSetEnabled";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkProducerProductLineSetEnabledReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerProductLineSetEnabled;
	}
}

export const checkProducerProductLineSetEnabledReadinessFx = Effect.fn(
	"checkProducerProductLineSetEnabledReadinessFx",
)(function* ({ config, save, action }: checkProducerProductLineSetEnabledReadinessFx.Props) {
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
