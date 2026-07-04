import { Effect } from "effect";
import { findActiveEffectByProducerJobId } from "~/effects/findActiveEffectByProducerJobId";
import { writeActiveEffectToSaveFx } from "~/effects/writeActiveEffectToSaveFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import type { ProducerRealtimeSyncScope } from "~/producer/ProducerRealtimeSyncTypes";
import { readProducerJobLine } from "~/producer/readProducerJobLine";
import { ensureGameSaveDraftFx } from "~/save/GameSaveDraftScopeFx";

export const syncProducerJobActiveEffectFx = Effect.fn("syncProducerJobActiveEffectFx")(function* ({
	job,
	readyAtMs,
	scope,
	startAtMs,
}: {
	job: GameSaveProducerJob;
	readyAtMs: number;
	scope: ProducerRealtimeSyncScope;
	startAtMs: number;
}) {
	const { config } = scope;
	const draft = yield* ensureGameSaveDraftFx();
	const line = readProducerJobLine({
		config,
		job,
		save: draft,
	});
	if (!line) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing line "${job.lineId}".`),
		);
	}
	if (!line.effect) return;

	const activeEffect = findActiveEffectByProducerJobId({
		producerJobId: job.id,
		save: draft,
	});
	if (!activeEffect) {
		return yield* Effect.fail(
			GameEngineError.saveInvalid(
				`Producer job "${job.id}" activates effect "${line.effect.id}" but has no active effect instance.`,
			),
		);
	}
	yield* writeActiveEffectToSaveFx({
		activeEffect: {
			...activeEffect,
			effectId: line.effect.id,
			endAtMs: readyAtMs,
			producerJobId: job.id,
			sourceItemInstanceId: job.itemInstanceId,
			startAtMs,
		},
		save: draft,
	});
});
