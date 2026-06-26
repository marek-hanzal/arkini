import { Effect } from "effect";
import { readProducerRuntimeTargetFx } from "~/v0/game/producer/readProducerRuntimeTargetFx";
import { readVisibleProducerProductIds } from "~/v0/game/producer/readVisibleProducerProductIds";
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
	const { producerDefinition, producerId, producerItem } = yield* readProducerRuntimeTargetFx({
		config,
		producerItemInstanceId: action.producerItemInstanceId,
		save,
	});
	if (!producerDefinition.productIds.includes(action.productId)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Product "${action.productId}" does not belong to producer "${producerDefinition.type}" on item "${producerItem.itemId}".`,
			),
		);
	}
	const visibleProductIds = readVisibleProducerProductIds({
		config,
		producerId,
		producerItemId: producerItem.itemId,
		producerItemInstanceId: action.producerItemInstanceId,
		productIds: producerDefinition.productIds,
		save,
	});
	if (!visibleProductIds.includes(action.productId)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Product "${action.productId}" is hidden for the current game state.`,
			),
		);
	}

	return {
		producerDefinition,
		producerItem,
	};
});
