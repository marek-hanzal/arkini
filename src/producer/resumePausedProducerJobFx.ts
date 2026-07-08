import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { readGamePausableJobResumedTiming } from "~/job/GamePausableJobTiming";
import {
	continueProducerQueueAt,
	stopProducerQueueAt,
} from "~/producer/ProducerRealtimeQueueHelpers";
import { readProducerJobEffectiveTimingFx } from "~/producer/readProducerJobEffectiveTimingFx";
import { readProducerStartGateReadyFx } from "~/producer/readProducerStartGateReadyFx";
import { syncProducerJobActiveEffectFx } from "~/producer/syncProducerJobActiveEffectFx";
import { writeProducerJobToSaveFx } from "~/producer/writeProducerJobToSaveFx";
import { ensureGameSaveDraftFx, readGameSaveDraftCurrentFx } from "~/save/GameSaveDraftScopeFx";

export const resumePausedProducerJobFx = Effect.fn("resumePausedProducerJobFx")(function* ({
	config,
	cursorAtMs,
	job,
	nowMs,
	realtimeProducerJobIds,
}: {
	config: GameConfig;
	cursorAtMs: number;
	job: GameSaveProducerJob;
	nowMs: number;
	realtimeProducerJobIds: ReadonlySet<string>;
}) {
	const startGateReady = yield* readProducerStartGateReadyFx({
		config,
		job,
		nowMs,
		realtimeProducerJobIds,
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
		config,
		job: resumedJob,
		readyAtMs: resumedTiming.readyAtMs,
		startAtMs: resumedTiming.startAtMs,
	});
	return continueProducerQueueAt(resumedTiming.readyAtMs);
});
