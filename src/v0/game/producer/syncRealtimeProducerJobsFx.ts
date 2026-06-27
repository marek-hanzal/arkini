import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import { findActiveEffectByProducerJobId } from "~/v0/game/effects/findActiveEffectByProducerJobId";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerJobWakeAtMs } from "~/v0/game/producer/producerDeliveryTiming";
import { readProducerJobEffectiveTimingFx } from "~/v0/game/producer/readProducerJobEffectiveTimingFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { compareProducerQueueJobs } from "~/v0/game/producer/compareProducerQueueJobs";

export namespace syncRealtimeProducerJobsFx {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

const groupProducerJobs = (save: GameSave) => {
	const groups = new Map<string, GameSaveProducerJob[]>();
	for (const job of Object.values(save.producerJobs)) {
		groups.set(job.producerItemInstanceId, [
			...(groups.get(job.producerItemInstanceId) ?? []),
			job,
		]);
	}
	return groups;
};

export const syncRealtimeProducerJobsFx = Effect.fn("syncRealtimeProducerJobsFx")(function* ({
	config,
	nowMs,
	save,
}: syncRealtimeProducerJobsFx.Props) {
	let nextSave: GameSave | undefined;
	const ensureNextSave = Effect.fn("syncRealtimeProducerJobsFx.ensureNextSave")(function* () {
		if (!nextSave) {
			nextSave = yield* cloneGameSaveFx({
				save,
			});
		}
		return nextSave;
	});

	for (const [, queue] of groupProducerJobs(save)) {
		let cursorAtMs = 0;
		const sortedQueue = [
			...queue,
		].sort(compareProducerQueueJobs);
		const realtimeProducerJobIds = new Set(
			sortedQueue.filter((job) => !job.delivery).map((job) => job.id),
		);

		for (const job of sortedQueue) {
			if (job.delivery) {
				cursorAtMs = readProducerJobWakeAtMs(job);
				continue;
			}

			const startAtMs = Math.max(job.startAtMs, cursorAtMs);
			const evaluateAtMs = startAtMs <= nowMs ? nowMs : startAtMs;
			const timing = yield* readProducerJobEffectiveTimingFx({
				config,
				evaluateAtMs,
				ignoredProducerJobIds: realtimeProducerJobIds,
				job,
				save: nextSave ?? save,
				startAtMs,
			});
			cursorAtMs = timing.readyAtMs;

			if (job.startAtMs === timing.startAtMs && job.readyAtMs === timing.readyAtMs) {
				continue;
			}

			const draft = yield* ensureNextSave();
			const liveJob = draft.producerJobs[job.id];
			if (!liveJob) continue;

			draft.producerJobs[job.id] = {
				...liveJob,
				readyAtMs: timing.readyAtMs,
				startAtMs: timing.startAtMs,
			};

			const product = config.products[job.productId];
			if (!product) {
				return yield* Effect.fail(
					GameEngineError.configReferenceMissing(`Missing product "${job.productId}".`),
				);
			}
			if (product.activatesEffectId) {
				const activeEffect = findActiveEffectByProducerJobId({
					producerJobId: job.id,
					save: draft,
				});
				if (!activeEffect) {
					return yield* Effect.fail(
						GameEngineError.saveInvalid(
							`Producer job "${job.id}" activates effect "${product.activatesEffectId}" but has no active effect instance.`,
						),
					);
				}
				draft.activeEffects[activeEffect.id] = {
					...activeEffect,
					effectId: product.activatesEffectId,
					endAtMs: timing.readyAtMs,
					producerJobId: job.id,
					sourceItemInstanceId: job.producerItemInstanceId,
					startAtMs: timing.startAtMs,
				};
			}
		}
	}

	if (!nextSave) return save;
	nextSave.updatedAtMs = nowMs;
	return nextSave;
});
