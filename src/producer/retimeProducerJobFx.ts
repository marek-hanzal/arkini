import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { continueProducerQueueAt } from "~/producer/ProducerRealtimeQueueHelpers";
import { readProducerJobEffectiveTimingFx } from "~/producer/readProducerJobEffectiveTimingFx";
import { syncProducerJobActiveEffectFx } from "~/producer/syncProducerJobActiveEffectFx";
import { writeProducerJobToSaveFx } from "~/producer/writeProducerJobToSaveFx";
import { ensureGameSaveDraftFx, readGameSaveDraftCurrentFx } from "~/save/GameSaveDraftScopeFx";

export const retimeProducerJobFx = Effect.fn("retimeProducerJobFx")(function* ({
	config,
	job,
	nowMs,
	realtimeProducerJobIds,
	startAtMs,
}: {
	config: GameConfig;
	job: GameSaveProducerJob;
	nowMs: number;
	realtimeProducerJobIds: ReadonlySet<string>;
	startAtMs: number;
}) {
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
		config,
		job: retimedJob,
		readyAtMs: timing.readyAtMs,
		startAtMs: timing.startAtMs,
	});
	return continueProducerQueueAt(timing.readyAtMs);
});
