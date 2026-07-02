import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerCapabilityDefinition } from "~/v0/game/config/readProducerCapabilityDefinition";
import { readProducerLineDefinition } from "~/v0/game/config/readProducerLineDefinition";

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

	const line = readProducerLineDefinition({
		producerDefinition,
		lineId: job.lineId,
	});
	if (!line) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing producer line "${job.lineId}".`),
		);
	}

	return {
		producerDefinition,
		producerItem,
		line,
	};
});
