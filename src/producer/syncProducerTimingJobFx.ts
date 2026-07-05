import { Effect } from "effect";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { stopProducerQueueAt } from "~/producer/ProducerRealtimeQueueHelpers";
import type {
	ProducerRealtimeQueueScope,
	ProducerRealtimeSyncScope,
} from "~/producer/ProducerRealtimeSyncTypes";
import { pauseProducerJobFx } from "~/producer/pauseProducerJobFx";
import { readProducerStartGateReadyFx } from "~/producer/readProducerStartGateReadyFx";
import { retimeProducerJobFx } from "~/producer/retimeProducerJobFx";

export const syncProducerTimingJobFx = Effect.fn("syncProducerTimingJobFx")(function* ({
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
});
