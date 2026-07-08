import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { createCompletedProducerJobResult } from "~/producer/ProducerJobCompletionEvents";
import type { ProducerChargeCompletionOutcome } from "~/producer/completeProducerJobChargesFx";
import { removeProducerJobFromSaveFx } from "~/producer/removeProducerJobFromSaveFx";
import { rescheduleQueueAfterCompletedProducerDeliveryFx } from "~/producer/rescheduleQueueAfterCompletedProducerDeliveryFx";
import { readProducerPlacementSuccessEffectsFx } from "~/producer/readProducerPlacementSuccessEffectsFx";
import type { ProducerPlacementSuccess } from "~/producer/ProducerJobCompletionTypes";

export const completeProducerPlacementSuccessFx = Effect.fn("completeProducerPlacementSuccessFx")(
	function* ({
		chargeOutcome,
		config,
		liveJob,
		nowMs,
		placementResult,
		save,
	}: {
		chargeOutcome: ProducerChargeCompletionOutcome | undefined;
		config: GameConfig;
		liveJob: GameSaveProducerJob;
		nowMs: number;
		placementResult: ProducerPlacementSuccess;
		save: GameSave;
	}) {
		yield* removeProducerJobFromSaveFx({
			jobId: liveJob.id,
			save: placementResult.save,
		});
		const { chargeEvents, placementEvents } = yield* readProducerPlacementSuccessEffectsFx({
			chargeOutcome,
			config,
			liveJob,
			nowMs,
			placementEvents: placementResult.events,
			placementSave: placementResult.save,
			save,
		});
		yield* rescheduleQueueAfterCompletedProducerDeliveryFx({
			config,
			liveJob,
			nextSave: placementResult.save,
			resumeAtMs: nowMs,
		});
		placementResult.save.updatedAtMs = nowMs;

		return createCompletedProducerJobResult({
			chargeEvents,
			job: liveJob,
			nowMs,
			placementEvents,
			save: placementResult.save,
		});
	},
);
