import { Context, Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/config/GameConfigTypes";
import { readProducerJobLine } from "~/producer/readProducerJobLine";
import { GameEngineError } from "~/engine/model/GameEngineError";
import {
	readGamePausableJobRemainingMsAtPause,
	readGamePausableJobResumedTiming,
} from "~/job/GamePausableJobTiming";
import { findActiveEffectByProducerJobId } from "~/effects/findActiveEffectByProducerJobId";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import {
	isWorldProducerJobPaused,
	readWorldProducerJobReleaseAtMs,
} from "~/world/readWorldProducerJobReleaseAtMs";
import { readProducerJobEffectiveTimingFx } from "~/producer/readProducerJobEffectiveTimingFx";
import { compareProducerQueueJobs } from "~/producer/compareProducerQueueJobs";
import { readProducerJobStartGateReadyFx } from "~/producer/readProducerJobStartGateReadyFx";
import { groupWorldProducerJobs } from "~/world/groupWorldProducerJobs";
import { readGameCheatSpeedMode } from "~/cheat/GameCheatSpeedMode";
import {
	ensureGameSaveDraftFx,
	provideGameSaveDraftScopeFx,
	readGameSaveDraftCurrentFx,
	readUpdatedGameSaveDraftResultFx,
} from "~/save/GameSaveDraftScopeFx";

export namespace syncRealtimeProducerJobsFx {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

type ProducerQueueSyncStep = {
	cursorAtMs: number;
	stopQueue: boolean;
};

type ProducerJobSyncState = "paused" | "sync_timing";

class ProducerRealtimeSyncScopeFx extends Context.Tag("ProducerRealtimeSyncScopeFx")<
	ProducerRealtimeSyncScopeFx,
	Pick<syncRealtimeProducerJobsFx.Props, "config" | "nowMs">
>() {
	//
}

class ProducerRealtimeQueueScopeFx extends Context.Tag("ProducerRealtimeQueueScopeFx")<
	ProducerRealtimeQueueScopeFx,
	{
		readonly realtimeProducerJobIds: ReadonlySet<string>;
	}
>() {
	//
}

const updateProducerJobActiveEffectFx = Effect.fn("updateProducerJobActiveEffectFx")(function* ({
	job,
	readyAtMs,
	startAtMs,
}: {
	job: GameSaveProducerJob;
	readyAtMs: number;
	startAtMs: number;
}) {
	const { config } = yield* ProducerRealtimeSyncScopeFx;
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
	draft.activeEffects[activeEffect.id] = {
		...activeEffect,
		effectId: line.effect.id,
		endAtMs: readyAtMs,
		producerJobId: job.id,
		sourceItemInstanceId: job.itemInstanceId,
		startAtMs,
	};
});

const readSortedProducerQueue = (queue: readonly GameSaveProducerJob[]) =>
	[
		...queue,
	].sort(compareProducerQueueJobs);

const readRealtimeProducerJobIds = (queue: readonly GameSaveProducerJob[]) =>
	new Set(queue.filter((job) => !job.delivery).map((job) => job.id));

const readHasPreviousNonDeliveryQueueJob = ({
	queue,
	queueIndex,
}: {
	queue: readonly GameSaveProducerJob[];
	queueIndex: number;
}) => queue.slice(0, queueIndex).some((previousJob) => !previousJob.delivery);

const continueProducerQueueAt = (cursorAtMs: number): ProducerQueueSyncStep => ({
	cursorAtMs,
	stopQueue: false,
});

const stopProducerQueueAt = (cursorAtMs: number): ProducerQueueSyncStep => ({
	cursorAtMs,
	stopQueue: true,
});

const syncProducerDeliveryCursorFx = Effect.fn(
	"syncRealtimeProducerJobsFx.syncProducerDeliveryCursorFx",
)(function* ({ cursorAtMs, job }: { cursorAtMs: number; job: GameSaveProducerJob }) {
	const wakeAtMs = readWorldProducerJobReleaseAtMs(job);
	return wakeAtMs === undefined
		? stopProducerQueueAt(cursorAtMs)
		: continueProducerQueueAt(wakeAtMs);
});

const readProducerJobSyncStartAtMsFx = Effect.fn(
	"syncRealtimeProducerJobsFx.readProducerJobSyncStartAtMsFx",
)(function* ({ cursorAtMs, job }: { cursorAtMs: number; job: GameSaveProducerJob }) {
	const { nowMs } = yield* ProducerRealtimeSyncScopeFx;
	const save = yield* readGameSaveDraftCurrentFx();
	return readGameCheatSpeedMode({
		save,
	}) === "instant"
		? Math.max(cursorAtMs, Math.min(job.startAtMs, nowMs))
		: Math.max(job.startAtMs, cursorAtMs);
});

const readProducerStartGateReadyFx = Effect.fn(
	"syncRealtimeProducerJobsFx.readProducerStartGateReadyFx",
)(function* ({ job }: { job: GameSaveProducerJob }) {
	const { config, nowMs } = yield* ProducerRealtimeSyncScopeFx;
	const { realtimeProducerJobIds } = yield* ProducerRealtimeQueueScopeFx;
	const save = yield* readGameSaveDraftCurrentFx();
	return yield* readProducerJobStartGateReadyFx({
		config,
		evaluateAtMs: nowMs,
		ignoredProducerJobIds: realtimeProducerJobIds,
		job,
		save,
	});
});

const resumePausedProducerJobFx = Effect.fn("syncRealtimeProducerJobsFx.resumePausedProducerJobFx")(
	function* ({ cursorAtMs, job }: { cursorAtMs: number; job: GameSaveProducerJob }) {
		const { config, nowMs } = yield* ProducerRealtimeSyncScopeFx;
		const { realtimeProducerJobIds } = yield* ProducerRealtimeQueueScopeFx;
		const startGateReady = yield* readProducerStartGateReadyFx({
			job,
		});
		if (!startGateReady) return stopProducerQueueAt(cursorAtMs);

		const save = yield* readGameSaveDraftCurrentFx();
		const remainingMs = job.remainingMs ?? 0;
		const effectiveTiming = yield* readProducerJobEffectiveTimingFx({
			config,
			evaluateAtMs: nowMs,
			ignoredProducerJobIds: realtimeProducerJobIds,
			job,
			save,
			startAtMs: nowMs,
		});
		const durationMs = Math.max(0, effectiveTiming.readyAtMs - effectiveTiming.startAtMs);
		const resumedTiming = readGamePausableJobResumedTiming({
			durationMs,
			nowMs,
			remainingMs,
		});

		const draft = yield* ensureGameSaveDraftFx();
		const liveJob = draft.producerJobs[job.id];
		if (!liveJob) return continueProducerQueueAt(cursorAtMs);

		const resumedJob = {
			...liveJob,
			pausedAtMs: undefined,
			readyAtMs: resumedTiming.readyAtMs,
			remainingMs: undefined,
			startAtMs: resumedTiming.startAtMs,
		};
		draft.producerJobs[job.id] = resumedJob;
		yield* updateProducerJobActiveEffectFx({
			job: resumedJob,
			readyAtMs: resumedTiming.readyAtMs,
			startAtMs: resumedTiming.startAtMs,
		});
		return continueProducerQueueAt(resumedTiming.readyAtMs);
	},
);

const pauseProducerJobFx = Effect.fn("syncRealtimeProducerJobsFx.pauseProducerJobFx")(function* ({
	hasPreviousNonDeliveryQueueJob,
	job,
	startAtMs,
}: {
	hasPreviousNonDeliveryQueueJob: boolean;
	job: GameSaveProducerJob;
	startAtMs: number;
}) {
	const { nowMs } = yield* ProducerRealtimeSyncScopeFx;
	const isRunningAtPause = startAtMs < nowMs && !hasPreviousNonDeliveryQueueJob;
	const pausedStartAtMs = isRunningAtPause ? startAtMs : nowMs;
	const remainingMs = isRunningAtPause
		? readGamePausableJobRemainingMsAtPause({
				job,
				nowMs,
				startAtMs,
			})
		: Math.max(0, job.readyAtMs - job.startAtMs);
	const readyAtMs = nowMs + remainingMs;
	const draft = yield* ensureGameSaveDraftFx();
	const liveJob = draft.producerJobs[job.id];
	if (!liveJob) return;

	const pausedJob = {
		...liveJob,
		pausedAtMs: nowMs,
		readyAtMs,
		remainingMs,
		startAtMs: pausedStartAtMs,
	};
	draft.producerJobs[job.id] = pausedJob;
	yield* updateProducerJobActiveEffectFx({
		job: pausedJob,
		readyAtMs,
		startAtMs: pausedStartAtMs,
	});
});

const retimeProducerJobFx = Effect.fn("syncRealtimeProducerJobsFx.retimeProducerJobFx")(function* ({
	job,
	startAtMs,
}: {
	job: GameSaveProducerJob;
	startAtMs: number;
}) {
	const { config, nowMs } = yield* ProducerRealtimeSyncScopeFx;
	const { realtimeProducerJobIds } = yield* ProducerRealtimeQueueScopeFx;
	const save = yield* readGameSaveDraftCurrentFx();
	const evaluateAtMs = startAtMs <= nowMs ? nowMs : startAtMs;
	const timing = yield* readProducerJobEffectiveTimingFx({
		config,
		evaluateAtMs,
		ignoredProducerJobIds: realtimeProducerJobIds,
		job,
		save,
		startAtMs,
	});

	if (job.startAtMs === timing.startAtMs && job.readyAtMs === timing.readyAtMs) {
		return continueProducerQueueAt(timing.readyAtMs);
	}

	const draft = yield* ensureGameSaveDraftFx();
	const liveJob = draft.producerJobs[job.id];
	if (!liveJob) return continueProducerQueueAt(timing.readyAtMs);

	const retimedJob = {
		...liveJob,
		readyAtMs: timing.readyAtMs,
		startAtMs: timing.startAtMs,
	};
	draft.producerJobs[job.id] = retimedJob;
	yield* updateProducerJobActiveEffectFx({
		job: retimedJob,
		readyAtMs: timing.readyAtMs,
		startAtMs: timing.startAtMs,
	});
	return continueProducerQueueAt(timing.readyAtMs);
});

const readProducerJobSyncState = ({ job }: { job: GameSaveProducerJob }): ProducerJobSyncState =>
	isWorldProducerJobPaused(job) ? "paused" : "sync_timing";

const syncProducerTimingJobFx = Effect.fn("syncRealtimeProducerJobsFx.syncProducerTimingJobFx")(
	function* ({
		cursorAtMs,
		hasPreviousNonDeliveryQueueJob,
		job,
		startAtMs,
	}: {
		cursorAtMs: number;
		hasPreviousNonDeliveryQueueJob: boolean;
		job: GameSaveProducerJob;
		startAtMs: number;
	}) {
		const { nowMs } = yield* ProducerRealtimeSyncScopeFx;
		const startGateReady =
			startAtMs <= nowMs
				? yield* readProducerStartGateReadyFx({
						job,
					})
				: true;
		if (!startGateReady) {
			yield* pauseProducerJobFx({
				hasPreviousNonDeliveryQueueJob,
				job,
				startAtMs,
			});
			return stopProducerQueueAt(cursorAtMs);
		}

		return yield* retimeProducerJobFx({
			job,
			startAtMs,
		});
	},
);

const syncRealtimeProducerJobFx = Effect.fn("syncRealtimeProducerJobsFx.syncRealtimeProducerJobFx")(
	function* ({
		cursorAtMs,
		hasPreviousNonDeliveryQueueJob,
		job,
	}: {
		cursorAtMs: number;
		hasPreviousNonDeliveryQueueJob: boolean;
		job: GameSaveProducerJob;
	}) {
		if (job.delivery) {
			return yield* syncProducerDeliveryCursorFx({
				cursorAtMs,
				job,
			});
		}

		const startAtMs = yield* readProducerJobSyncStartAtMsFx({
			cursorAtMs,
			job,
		});

		return yield* match(
			readProducerJobSyncState({
				job,
			}),
		)
			.with("paused", () =>
				resumePausedProducerJobFx({
					cursorAtMs,
					job,
				}),
			)
			.with("sync_timing", () =>
				syncProducerTimingJobFx({
					cursorAtMs,
					hasPreviousNonDeliveryQueueJob,
					job,
					startAtMs,
				}),
			)
			.exhaustive();
	},
);

const syncProducerQueueFx = Effect.fn("syncRealtimeProducerJobsFx.syncProducerQueueFx")(function* ({
	queue,
}: {
	queue: readonly GameSaveProducerJob[];
}) {
	const sortedQueue = readSortedProducerQueue(queue);
	let cursorAtMs = 0;

	for (let queueIndex = 0; queueIndex < sortedQueue.length; queueIndex += 1) {
		const job = sortedQueue[queueIndex];
		if (!job) continue;

		const step = yield* syncRealtimeProducerJobFx({
			cursorAtMs,
			hasPreviousNonDeliveryQueueJob: readHasPreviousNonDeliveryQueueJob({
				queue: sortedQueue,
				queueIndex,
			}),
			job,
		});
		cursorAtMs = step.cursorAtMs;
		if (step.stopQueue) break;
	}
});

const syncProducerQueueWithScopeFx = Effect.fn(
	"syncRealtimeProducerJobsFx.syncProducerQueueWithScopeFx",
)(function* ({ queue }: { queue: readonly GameSaveProducerJob[] }) {
	const sortedQueue = readSortedProducerQueue(queue);
	return yield* syncProducerQueueFx({
		queue: sortedQueue,
	}).pipe(
		Effect.provideService(ProducerRealtimeQueueScopeFx, {
			realtimeProducerJobIds: readRealtimeProducerJobIds(sortedQueue),
		}),
	);
});

const syncRealtimeProducerJobsProgramFx = Effect.fn(
	"syncRealtimeProducerJobsFx.syncRealtimeProducerJobsProgramFx",
)(function* () {
	const save = yield* readGameSaveDraftCurrentFx();
	for (const [, queue] of groupWorldProducerJobs(save)) {
		yield* syncProducerQueueWithScopeFx({
			queue,
		});
	}

	const { nowMs } = yield* ProducerRealtimeSyncScopeFx;
	return yield* readUpdatedGameSaveDraftResultFx({
		nowMs,
	});
});

export const syncRealtimeProducerJobsFx = Effect.fn("syncRealtimeProducerJobsFx")(function* ({
	config,
	nowMs,
	save,
}: syncRealtimeProducerJobsFx.Props) {
	return yield* syncRealtimeProducerJobsProgramFx().pipe(
		Effect.provideService(ProducerRealtimeSyncScopeFx, {
			config,
			nowMs,
		}),
		(effect) =>
			provideGameSaveDraftScopeFx(effect, {
				save,
			}),
	);
});
