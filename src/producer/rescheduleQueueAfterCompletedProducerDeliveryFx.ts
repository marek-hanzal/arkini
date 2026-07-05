import { Effect } from "effect";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { rescheduleProducerQueueAfterBlockedDeliveryFx } from "~/producer/rescheduleProducerQueueAfterBlockedDeliveryFx";
import type { ProducerJobCompletionScope } from "~/producer/ProducerJobCompletionTypes";

export const rescheduleQueueAfterCompletedProducerDeliveryFx = Effect.fn(
	"rescheduleQueueAfterCompletedProducerDeliveryFx",
)(function* ({
	liveJob,
	nextSave,
	resumeAtMs,
	scope,
}: {
	liveJob: GameSaveProducerJob;
	nextSave: GameSave;
	resumeAtMs: number;
	scope: ProducerJobCompletionScope;
}) {
	if (!liveJob.delivery) return;

	yield* rescheduleProducerQueueAfterBlockedDeliveryFx({
		blockedJobId: liveJob.id,
		config: scope.config,
		nextSave,
		itemInstanceId: liveJob.itemInstanceId,
		resumeAtMs,
	});
});
