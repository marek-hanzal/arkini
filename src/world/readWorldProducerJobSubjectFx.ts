import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { readProducerCapabilityDefinition } from "~/config/readProducerCapabilityDefinition";
import { readLineDefinition } from "~/config/readLineDefinition";

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
	const producerItem = save.board.items[job.itemInstanceId];
	if (!producerItem) {
		return yield* Effect.fail(
			GameEngineError.saveInvalid(
				`Producer job target "${job.itemInstanceId}" must be a board item.`,
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

	const line = readLineDefinition({
		producerDefinition,
		lineId: job.lineId,
	});
	if (!line) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing line "${job.lineId}".`),
		);
	}

	return {
		producerDefinition,
		producerItem,
		line,
	};
});
