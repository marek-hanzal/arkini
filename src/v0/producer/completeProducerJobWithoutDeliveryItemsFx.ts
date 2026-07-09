import { Effect } from "effect";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { createCompletedProducerJobResult } from "~/producer/ProducerJobCompletionEvents";
import { spendProducerChargeCostAfterCompletedDeliveryFx } from "~/producer/completeProducerJobChargesFx";
import { removeProducerJobFromSaveFx } from "~/producer/removeProducerJobFromSaveFx";
import { rescheduleQueueAfterCompletedProducerDeliveryFx } from "~/producer/rescheduleQueueAfterCompletedProducerDeliveryFx";

export const completeProducerJobWithoutDeliveryItemsFx = Effect.fn(
	"completeProducerJobWithoutDeliveryItemsFx",
)(function* ({
	config,
	liveJob,
	nowMs,
	save,
}: {
	config: GameConfig;
	liveJob: GameSaveProducerJob;
	nowMs: number;
	save: GameSave;
}) {
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	yield* removeProducerJobFromSaveFx({
		jobId: liveJob.id,
		save: nextSave,
	});
	const chargeEvents = yield* spendProducerChargeCostAfterCompletedDeliveryFx({
		config,
		job: liveJob,
		nextSave,
		nowMs,
	});
	yield* rescheduleQueueAfterCompletedProducerDeliveryFx({
		config,
		liveJob,
		nextSave,
		resumeAtMs: nowMs,
	});
	nextSave.updatedAtMs = nowMs;

	return createCompletedProducerJobResult({
		chargeEvents,
		job: liveJob,
		nowMs,
		save: nextSave,
	});
});
