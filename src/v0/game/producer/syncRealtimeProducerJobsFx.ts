import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import {
	readGamePausableJobRemainingMsAtPause,
	readGamePausableJobResumedTiming,
} from "~/v0/game/job/GamePausableJobTiming";
import { findActiveEffectByProducerJobId } from "~/v0/game/effects/findActiveEffectByProducerJobId";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import {
	isWorldProducerJobPaused,
	readWorldProducerJobReleaseAtMs,
} from "~/v0/game/world/readWorldProducerJobReleaseAtMs";
import { readProducerJobEffectiveTimingFx } from "~/v0/game/producer/readProducerJobEffectiveTimingFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { compareProducerQueueJobs } from "~/v0/game/producer/compareProducerQueueJobs";
import { readWorldProducerRequirementFactsFx } from "~/v0/game/world/readWorldProducerRequirementFactsFx";
import { readProducerJobStartGateReadyFx } from "~/v0/game/producer/readProducerJobStartGateReadyFx";
import { groupWorldProducerJobs } from "~/v0/game/world/groupWorldProducerJobs";

export namespace syncRealtimeProducerJobsFx {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

const updateProducerJobActiveEffectFx = Effect.fn("updateProducerJobActiveEffectFx")(function* ({
	config,
	draft,
	job,
	readyAtMs,
	startAtMs,
}: {
	config: GameConfig;
	draft: GameSave;
	job: GameSaveProducerJob;
	readyAtMs: number;
	startAtMs: number;
}) {
	const product = config.products[job.productId];
	if (!product) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing product "${job.productId}".`),
		);
	}
	if (!product.activatesEffectId) return;

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
		endAtMs: readyAtMs,
		producerJobId: job.id,
		sourceItemInstanceId: job.producerItemInstanceId,
		startAtMs,
	};
});

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

	for (const [, queue] of groupWorldProducerJobs(save)) {
		let cursorAtMs = 0;
		const sortedQueue = [
			...queue,
		].sort(compareProducerQueueJobs);
		const realtimeProducerJobIds = new Set(
			sortedQueue.filter((job) => !job.delivery).map((job) => job.id),
		);

		for (let queueIndex = 0; queueIndex < sortedQueue.length; queueIndex += 1) {
			const job = sortedQueue[queueIndex];
			if (!job) continue;

			const hasPreviousNonDeliveryQueueJob = sortedQueue
				.slice(0, queueIndex)
				.some((previousJob) => !previousJob.delivery);

			if (job.delivery) {
				const wakeAtMs = readWorldProducerJobReleaseAtMs(job);
				if (wakeAtMs === undefined) break;
				cursorAtMs = wakeAtMs;
				continue;
			}

			const startAtMs = Math.max(job.startAtMs, cursorAtMs);
			const requirementFacts = yield* readWorldProducerRequirementFactsFx({
				config,
				job,
				save: nextSave ?? save,
			});
			const requirementsReady = requirementFacts.ready;

			if (isWorldProducerJobPaused(job)) {
				const startGateReady = yield* readProducerJobStartGateReadyFx({
					config,
					evaluateAtMs: nowMs,
					ignoredProducerJobIds: realtimeProducerJobIds,
					job,
					save: nextSave ?? save,
				});
				if (!requirementsReady || !startGateReady) break;

				const remainingMs = job.remainingMs ?? 0;
				const effectiveTiming = yield* readProducerJobEffectiveTimingFx({
					config,
					evaluateAtMs: nowMs,
					ignoredProducerJobIds: realtimeProducerJobIds,
					job,
					save: nextSave ?? save,
					startAtMs: nowMs,
				});
				const durationMs = Math.max(
					0,
					effectiveTiming.readyAtMs - effectiveTiming.startAtMs,
				);
				const resumedTiming = readGamePausableJobResumedTiming({
					durationMs,
					nowMs,
					remainingMs,
				});

				const draft = yield* ensureNextSave();
				const liveJob = draft.producerJobs[job.id];
				if (!liveJob) continue;

				draft.producerJobs[job.id] = {
					...liveJob,
					pausedAtMs: undefined,
					readyAtMs: resumedTiming.readyAtMs,
					remainingMs: undefined,
					startAtMs: resumedTiming.startAtMs,
				};
				yield* updateProducerJobActiveEffectFx({
					config,
					draft,
					job: draft.producerJobs[job.id],
					readyAtMs: resumedTiming.readyAtMs,
					startAtMs: resumedTiming.startAtMs,
				});
				cursorAtMs = resumedTiming.readyAtMs;
				continue;
			}

			const shouldCheckStartGate =
				startAtMs === nowMs || (hasPreviousNonDeliveryQueueJob && startAtMs <= nowMs);
			const startGateReady = shouldCheckStartGate
				? yield* readProducerJobStartGateReadyFx({
						config,
						evaluateAtMs: nowMs,
						ignoredProducerJobIds: realtimeProducerJobIds,
						job,
						save: nextSave ?? save,
					})
				: true;
			if ((!requirementsReady || !startGateReady) && startAtMs <= nowMs) {
				const pausedStartAtMs = startGateReady ? startAtMs : nowMs;
				const remainingMs = startGateReady
					? readGamePausableJobRemainingMsAtPause({
							job,
							nowMs,
							startAtMs,
						})
					: Math.max(0, job.readyAtMs - job.startAtMs);
				const readyAtMs = nowMs + remainingMs;
				const draft = yield* ensureNextSave();
				const liveJob = draft.producerJobs[job.id];
				if (!liveJob) continue;

				draft.producerJobs[job.id] = {
					...liveJob,
					pausedAtMs: nowMs,
					readyAtMs,
					remainingMs,
					startAtMs: pausedStartAtMs,
				};
				yield* updateProducerJobActiveEffectFx({
					config,
					draft,
					job: draft.producerJobs[job.id],
					readyAtMs,
					startAtMs: pausedStartAtMs,
				});
				break;
			}

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
			yield* updateProducerJobActiveEffectFx({
				config,
				draft,
				job: draft.producerJobs[job.id],
				readyAtMs: timing.readyAtMs,
				startAtMs: timing.startAtMs,
			});
		}
	}

	if (!nextSave) return save;
	nextSave.updatedAtMs = nowMs;
	return nextSave;
});
