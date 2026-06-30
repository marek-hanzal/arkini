import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerCapabilityDefinition } from "~/v0/game/config/readProducerCapabilityDefinition";

export namespace readWorldProducerJobSubjectFx {
	export interface Props {
		config: GameConfig;
		job: GameSaveProducerJob;
		save: GameSave;
	}
}

export const readWorldProducerJobSubjectFx = Effect.fn("readWorldProducerJobSubjectFx")(function* ({
	config,
	job,
	save,
}: readWorldProducerJobSubjectFx.Props) {
	const producerItem = save.board.items[job.producerItemInstanceId];
	if (!producerItem) {
		return yield* Effect.fail(
			GameEngineError.saveInvalid(
				`Producer job target "${job.producerItemInstanceId}" must be a board item.`,
			),
		);
	}

	const producerDefinition = readProducerCapabilityDefinition({
		config,
		producerId: producerItem.itemId,
	});
	if (!producerDefinition) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Missing producer-like definition "${producerItem.itemId}".`,
			),
		);
	}

	const product = config.products[job.productId];
	if (!product) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing product "${job.productId}".`),
		);
	}

	return {
		producerDefinition,
		producerItem,
		product,
	};
});
