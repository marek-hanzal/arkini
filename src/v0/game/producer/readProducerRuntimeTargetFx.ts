import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerBoardItemFx } from "~/v0/game/producer/readProducerBoardItemFx";

export namespace readProducerRuntimeTargetFx {
	export interface Props {
		config: GameConfig;
		producerItemInstanceId: string;
		save: GameSave;
	}
}

export const readProducerRuntimeTargetFx = Effect.fn("readProducerRuntimeTargetFx")(function* ({
	config,
	producerItemInstanceId,
	save,
}: readProducerRuntimeTargetFx.Props) {
	const producerItem = yield* readProducerBoardItemFx({
		config,
		producerItemInstanceId,
		save,
	});
	const producerId = producerItem.itemId;
	const producerDefinition = config.producers[producerId];
	if (!producerDefinition) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Item "${producerItem.itemId}" is not a producer.`,
			),
		);
	}

	return {
		producerDefinition,
		producerId,
		producerItem,
	};
});
