import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { stopProducerQueueAt } from "~/producer/ProducerRealtimeQueueHelpers";
import { pauseProducerJobFx } from "~/producer/pauseProducerJobFx";
import { readProducerStartGateReadyFx } from "~/producer/readProducerStartGateReadyFx";
import { retimeProducerJobFx } from "~/producer/retimeProducerJobFx";

export const syncProducerTimingJobFx = Effect.fn("syncProducerTimingJobFx")(function* ({
	config,
	cursorAtMs,
	hasPreviousNonDeliveryQueueJob,
	job,
	nowMs,
	realtimeProducerJobIds,
	startAtMs,
}: {
	config: GameConfig;
	cursorAtMs: number;
	hasPreviousNonDeliveryQueueJob: boolean;
	job: GameSaveProducerJob;
	nowMs: number;
	realtimeProducerJobIds: ReadonlySet<string>;
	startAtMs: number;
}) {
	const startGateReady =
		startAtMs <= nowMs
			? yield* readProducerStartGateReadyFx({
					config,
					job,
					nowMs,
					realtimeProducerJobIds,
				})
			: true;
	if (!startGateReady) {
		yield* pauseProducerJobFx({
			config,
			hasPreviousNonDeliveryQueueJob,
			job,
			nowMs,
			startAtMs,
		});
		return stopProducerQueueAt(cursorAtMs);
	}

	return yield* retimeProducerJobFx({
		config,
		job,
		nowMs,
		realtimeProducerJobIds,
		startAtMs,
	});
});
