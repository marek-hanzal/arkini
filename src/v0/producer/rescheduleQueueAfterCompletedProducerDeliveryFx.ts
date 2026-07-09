import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { rescheduleProducerQueueAfterBlockedDeliveryFx } from "~/producer/rescheduleProducerQueueAfterBlockedDeliveryFx";

export const rescheduleQueueAfterCompletedProducerDeliveryFx = Effect.fn(
	"rescheduleQueueAfterCompletedProducerDeliveryFx",
)(function* ({
	config,
	liveJob,
	nextSave,
	resumeAtMs,
}: {
	config: GameConfig;
	liveJob: GameSaveProducerJob;
	nextSave: GameSave;
	resumeAtMs: number;
}) {
	if (!liveJob.delivery) return;

	yield* rescheduleProducerQueueAfterBlockedDeliveryFx({
		blockedJobId: liveJob.id,
		config,
		nextSave,
		itemInstanceId: liveJob.itemInstanceId,
		resumeAtMs,
	});
});
