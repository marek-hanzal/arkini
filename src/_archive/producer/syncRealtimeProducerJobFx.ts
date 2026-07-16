import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { readProducerJobSyncStartAtMsFx } from "~/producer/readProducerJobSyncStartAtMsFx";
import { readProducerJobSyncState } from "~/producer/readProducerJobSyncState";
import { resumePausedProducerJobFx } from "~/producer/resumePausedProducerJobFx";
import { syncProducerDeliveryCursorFx } from "~/producer/syncProducerDeliveryCursorFx";
import { syncProducerTimingJobFx } from "~/producer/syncProducerTimingJobFx";

export const syncRealtimeProducerJobFx = Effect.fn("syncRealtimeProducerJobFx")(function* ({
	config,
	cursorAtMs,
	hasPreviousNonDeliveryQueueJob,
	job,
	nowMs,
	realtimeProducerJobIds,
}: {
	config: GameConfig;
	cursorAtMs: number;
	hasPreviousNonDeliveryQueueJob: boolean;
	job: GameSaveProducerJob;
	nowMs: number;
	realtimeProducerJobIds: ReadonlySet<string>;
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
		nowMs,
	});

	return yield* match(
		readProducerJobSyncState({
			job,
		}),
	)
		.with("paused", () =>
			resumePausedProducerJobFx({
				config,
				cursorAtMs,
				job,
				nowMs,
				realtimeProducerJobIds,
			}),
		)
		.with("sync_timing", () =>
			syncProducerTimingJobFx({
				config,
				cursorAtMs,
				hasPreviousNonDeliveryQueueJob,
				job,
				nowMs,
				realtimeProducerJobIds,
				startAtMs,
			}),
		)
		.exhaustive();
});
