import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readProducerBoardItemFx } from "~/producer/readProducerBoardItemFx";
import { readProducerCapabilityDefinition } from "~/config/GameItemCapabilities";

export namespace readProducerRuntimeTargetFx {
	export interface Props {
		config: GameConfig;
		itemInstanceId: string;
		save: GameSave;
	}
}

export const readProducerRuntimeTargetFx = Effect.fn("readProducerRuntimeTargetFx")(function* ({
	config,
	itemInstanceId,
	save,
}: readProducerRuntimeTargetFx.Props) {
	const producerItem = yield* readProducerBoardItemFx({
		config,
		itemInstanceId,
		save,
	});
	const producerId = producerItem.itemId;
	const producerDefinition = readProducerCapabilityDefinition({
		config,
		producerId,
	});
	if (!producerDefinition) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Item "${producerItem.itemId}" is not a producer-like capability.`,
			),
		);
	}

	return {
		producerDefinition,
		producerId,
		producerItem,
	};
});
