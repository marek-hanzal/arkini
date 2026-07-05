import { Effect } from "effect";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { createCompletedProducerJobResult } from "~/producer/ProducerJobCompletionEvents";
import type { ProducerChargeCompletionOutcome } from "~/producer/completeProducerJobChargesFx";
import { removeProducerJobFromSaveFx } from "~/producer/removeProducerJobFromSaveFx";
import { rescheduleQueueAfterCompletedProducerDeliveryFx } from "~/producer/rescheduleQueueAfterCompletedProducerDeliveryFx";
import { readProducerPlacementSuccessEffectsFx } from "~/producer/readProducerPlacementSuccessEffectsFx";
import type {
	ProducerJobCompletionScope,
	ProducerPlacementSuccess,
} from "~/producer/ProducerJobCompletionTypes";

export const completeProducerPlacementSuccessFx = Effect.fn("completeProducerPlacementSuccessFx")(
	function* ({
		chargeOutcome,
		liveJob,
		placementResult,
		scope,
	}: {
		chargeOutcome: ProducerChargeCompletionOutcome | undefined;
		liveJob: GameSaveProducerJob;
		placementResult: ProducerPlacementSuccess;
		scope: ProducerJobCompletionScope;
	}) {
		const { nowMs } = scope;
		yield* removeProducerJobFromSaveFx({
			jobId: liveJob.id,
			save: placementResult.save,
		});
		const { chargeEvents, placementEvents } = yield* readProducerPlacementSuccessEffectsFx({
			chargeOutcome,
			liveJob,
			placementEvents: placementResult.events,
			placementSave: placementResult.save,
			scope,
		});
		yield* rescheduleQueueAfterCompletedProducerDeliveryFx({
			liveJob,
			nextSave: placementResult.save,
			resumeAtMs: nowMs,
			scope,
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
