import { Effect } from "effect";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { createCompletedProducerJobResult } from "~/producer/ProducerJobCompletionEvents";
import { spendProducerChargeCostAfterCompletedDeliveryFx } from "~/producer/completeProducerJobChargesFx";
import { removeProducerJobFromSaveFx } from "~/producer/removeProducerJobFromSaveFx";
import { rescheduleQueueAfterCompletedProducerDeliveryFx } from "~/producer/rescheduleQueueAfterCompletedProducerDeliveryFx";
import type { ProducerJobCompletionScope } from "~/producer/ProducerJobCompletionTypes";

export const completeProducerJobWithoutDeliveryItemsFx = Effect.fn(
	"completeProducerJobWithoutDeliveryItemsFx",
)(function* ({
	liveJob,
	scope,
}: {
	liveJob: GameSaveProducerJob;
	scope: ProducerJobCompletionScope;
}) {
	const { nowMs, save } = scope;
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	yield* removeProducerJobFromSaveFx({
		jobId: liveJob.id,
		save: nextSave,
	});
	const chargeEvents = yield* spendProducerChargeCostAfterCompletedDeliveryFx({
		config: scope.config,
		job: liveJob,
		nextSave,
		nowMs,
	});
	yield* rescheduleQueueAfterCompletedProducerDeliveryFx({
		liveJob,
		nextSave,
		resumeAtMs: nowMs,
		scope,
	});
	nextSave.updatedAtMs = nowMs;

	return createCompletedProducerJobResult({
		chargeEvents,
		job: liveJob,
		nowMs,
		save: nextSave,
	});
});
