import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { readGamePausableJobRemainingMsAtPause } from "~/job/GamePausableJobTiming";
import { syncProducerJobActiveEffectFx } from "~/producer/syncProducerJobActiveEffectFx";
import { writeProducerJobToSaveFx } from "~/producer/writeProducerJobToSaveFx";
import { ensureGameSaveDraftFx } from "~/save/GameSaveDraftScopeFx";

export const pauseProducerJobFx = Effect.fn("pauseProducerJobFx")(function* ({
	config,
	hasPreviousNonDeliveryQueueJob,
	job,
	nowMs,
	startAtMs,
}: {
	config: GameConfig;
	hasPreviousNonDeliveryQueueJob: boolean;
	job: GameSaveProducerJob;
	nowMs: number;
	startAtMs: number;
}) {
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
		config,
		job: pausedJob,
		readyAtMs,
		startAtMs: pausedStartAtMs,
	});
});
