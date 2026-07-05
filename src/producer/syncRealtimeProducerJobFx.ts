import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import type {
	ProducerRealtimeQueueScope,
	ProducerRealtimeSyncScope,
} from "~/producer/ProducerRealtimeSyncTypes";
import { readProducerJobSyncStartAtMsFx } from "~/producer/readProducerJobSyncStartAtMsFx";
import { readProducerJobSyncState } from "~/producer/readProducerJobSyncState";
import { resumePausedProducerJobFx } from "~/producer/resumePausedProducerJobFx";
import { syncProducerDeliveryCursorFx } from "~/producer/syncProducerDeliveryCursorFx";
import { syncProducerTimingJobFx } from "~/producer/syncProducerTimingJobFx";

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
