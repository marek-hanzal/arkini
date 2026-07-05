import { Effect } from "effect";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { continueProducerQueueAt } from "~/producer/ProducerRealtimeQueueHelpers";
import type {
	ProducerRealtimeQueueScope,
	ProducerRealtimeSyncScope,
} from "~/producer/ProducerRealtimeSyncTypes";
import { readProducerJobEffectiveTimingFx } from "~/producer/readProducerJobEffectiveTimingFx";
import { syncProducerJobActiveEffectFx } from "~/producer/syncProducerJobActiveEffectFx";
import { writeProducerJobToSaveFx } from "~/producer/writeProducerJobToSaveFx";
import { ensureGameSaveDraftFx, readGameSaveDraftCurrentFx } from "~/save/GameSaveDraftScopeFx";

export const retimeProducerJobFx = Effect.fn("retimeProducerJobFx")(function* ({
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
