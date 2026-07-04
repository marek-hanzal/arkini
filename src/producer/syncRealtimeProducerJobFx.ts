import { Effect } from "effect";
import { match } from "ts-pattern";
import { readGameCheatSpeedMode } from "~/cheat/GameCheatSpeedMode";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import {
	readGamePausableJobRemainingMsAtPause,
	readGamePausableJobResumedTiming,
} from "~/job/GamePausableJobTiming";
import {
	continueProducerQueueAt,
	stopProducerQueueAt,
} from "~/producer/ProducerRealtimeQueueHelpers";
import type {
	ProducerJobSyncState,
	ProducerRealtimeQueueScope,
	ProducerRealtimeSyncScope,
} from "~/producer/ProducerRealtimeSyncTypes";
import { readProducerJobEffectiveTimingFx } from "~/producer/readProducerJobEffectiveTimingFx";
import { readProducerJobStartGateReadyFx } from "~/producer/readProducerJobStartGateReadyFx";
import { syncProducerJobActiveEffectFx } from "~/producer/syncProducerJobActiveEffectFx";
import { writeProducerJobToSaveFx } from "~/producer/writeProducerJobToSaveFx";
import { ensureGameSaveDraftFx, readGameSaveDraftCurrentFx } from "~/save/GameSaveDraftScopeFx";
import {
	isWorldProducerJobPaused,
	readWorldProducerJobReleaseAtMs,
} from "~/world/readWorldProducerJobReleaseAtMs";

const syncProducerDeliveryCursorFx = Effect.fn(
	"syncRealtimeProducerJobFx.syncProducerDeliveryCursorFx",
)(function* ({ cursorAtMs, job }: { cursorAtMs: number; job: GameSaveProducerJob }) {
	const wakeAtMs = readWorldProducerJobReleaseAtMs(job);
	return wakeAtMs === undefined
		? stopProducerQueueAt(cursorAtMs)
		: continueProducerQueueAt(wakeAtMs);
});

const readProducerJobSyncStartAtMsFx = Effect.fn(
	"syncRealtimeProducerJobFx.readProducerJobSyncStartAtMsFx",
)(function* ({
	cursorAtMs,
	job,
	scope,
}: {
	cursorAtMs: number;
	job: GameSaveProducerJob;
	scope: ProducerRealtimeSyncScope;
}) {
	const { nowMs } = scope;
	const save = yield* readGameSaveDraftCurrentFx();
	return readGameCheatSpeedMode({
		save,
	}) === "instant"
		? Math.max(cursorAtMs, Math.min(job.startAtMs, nowMs))
		: Math.max(job.startAtMs, cursorAtMs);
});

const readProducerStartGateReadyFx = Effect.fn(
	"syncRealtimeProducerJobFx.readProducerStartGateReadyFx",
)(function* ({
	job,
	queueScope,
	scope,
}: {
	job: GameSaveProducerJob;
	queueScope: ProducerRealtimeQueueScope;
	scope: ProducerRealtimeSyncScope;
}) {
	const { config, nowMs } = scope;
	const { realtimeProducerJobIds } = queueScope;
	const save = yield* readGameSaveDraftCurrentFx();
	return yield* readProducerJobStartGateReadyFx({
		config,
		evaluateAtMs: nowMs,
		ignoredProducerJobIds: realtimeProducerJobIds,
		job,
		save,
	});
});

const resumePausedProducerJobFx = Effect.fn("syncRealtimeProducerJobFx.resumePausedProducerJobFx")(
	function* ({
		cursorAtMs,
		job,
		queueScope,
		scope,
	}: {
		cursorAtMs: number;
		job: GameSaveProducerJob;
		queueScope: ProducerRealtimeQueueScope;
		scope: ProducerRealtimeSyncScope;
	}) {
		const { config, nowMs } = scope;
		const { realtimeProducerJobIds } = queueScope;
		const startGateReady = yield* readProducerStartGateReadyFx({
			job,
			queueScope,
			scope,
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
		yield* writeProducerJobToSaveFx({
			job: resumedJob,
			save: draft,
		});
		yield* syncProducerJobActiveEffectFx({
			job: resumedJob,
			readyAtMs: resumedTiming.readyAtMs,
			scope,
			startAtMs: resumedTiming.startAtMs,
		});
		return continueProducerQueueAt(resumedTiming.readyAtMs);
	},
);

const pauseProducerJobFx = Effect.fn("syncRealtimeProducerJobFx.pauseProducerJobFx")(function* ({
	hasPreviousNonDeliveryQueueJob,
	job,
	scope,
	startAtMs,
}: {
	hasPreviousNonDeliveryQueueJob: boolean;
	job: GameSaveProducerJob;
	scope: ProducerRealtimeSyncScope;
	startAtMs: number;
}) {
	const { nowMs } = scope;
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
	yield* writeProducerJobToSaveFx({
		job: pausedJob,
		save: draft,
	});
	yield* syncProducerJobActiveEffectFx({
		job: pausedJob,
		readyAtMs,
		scope,
		startAtMs: pausedStartAtMs,
	});
});

const retimeProducerJobFx = Effect.fn("syncRealtimeProducerJobFx.retimeProducerJobFx")(function* ({
	job,
	queueScope,
	scope,
	startAtMs,
}: {
	job: GameSaveProducerJob;
	queueScope: ProducerRealtimeQueueScope;
	scope: ProducerRealtimeSyncScope;
	startAtMs: number;
}) {
	const { config, nowMs } = scope;
	const { realtimeProducerJobIds } = queueScope;
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
	yield* writeProducerJobToSaveFx({
		job: retimedJob,
		save: draft,
	});
	yield* syncProducerJobActiveEffectFx({
		job: retimedJob,
		readyAtMs: timing.readyAtMs,
		scope,
		startAtMs: timing.startAtMs,
	});
	return continueProducerQueueAt(timing.readyAtMs);
});

const readProducerJobSyncState = ({ job }: { job: GameSaveProducerJob }): ProducerJobSyncState =>
	isWorldProducerJobPaused(job) ? "paused" : "sync_timing";

const syncProducerTimingJobFx = Effect.fn("syncRealtimeProducerJobFx.syncProducerTimingJobFx")(
	function* ({
		cursorAtMs,
		hasPreviousNonDeliveryQueueJob,
		job,
		queueScope,
		scope,
		startAtMs,
	}: {
		cursorAtMs: number;
		hasPreviousNonDeliveryQueueJob: boolean;
		job: GameSaveProducerJob;
		queueScope: ProducerRealtimeQueueScope;
		scope: ProducerRealtimeSyncScope;
		startAtMs: number;
	}) {
		const { nowMs } = scope;
		const startGateReady =
			startAtMs <= nowMs
				? yield* readProducerStartGateReadyFx({
						job,
						queueScope,
						scope,
					})
				: true;
		if (!startGateReady) {
			yield* pauseProducerJobFx({
				hasPreviousNonDeliveryQueueJob,
				job,
				scope,
				startAtMs,
			});
			return stopProducerQueueAt(cursorAtMs);
		}

		return yield* retimeProducerJobFx({
			job,
			queueScope,
			scope,
			startAtMs,
		});
	},
);

export const syncRealtimeProducerJobFx = Effect.fn("syncRealtimeProducerJobFx")(function* ({
	cursorAtMs,
	hasPreviousNonDeliveryQueueJob,
	job,
	queueScope,
	scope,
}: {
	cursorAtMs: number;
	hasPreviousNonDeliveryQueueJob: boolean;
	job: GameSaveProducerJob;
	queueScope: ProducerRealtimeQueueScope;
	scope: ProducerRealtimeSyncScope;
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
		scope,
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
				queueScope,
				scope,
			}),
		)
		.with("sync_timing", () =>
			syncProducerTimingJobFx({
				cursorAtMs,
				hasPreviousNonDeliveryQueueJob,
				job,
				queueScope,
				scope,
				startAtMs,
			}),
		)
		.exhaustive();
});
