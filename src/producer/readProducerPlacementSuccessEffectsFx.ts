import { Effect } from "effect";
import { removeBoardItemFromSaveFx } from "~/board/removeBoardItemFromSaveFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import {
	createProducerChargesDepletedRemovalEvent,
	type ProducerCompletionEvents,
} from "~/producer/ProducerJobCompletionEvents";
import type { ProducerChargeCompletionOutcome } from "~/producer/completeProducerJobChargesFx";
import { spendProducerChargeCostAfterCompletedDeliveryFx } from "~/producer/completeProducerJobChargesFx";
import { replaceDepletedProducerSourceCellOutputFx } from "~/producer/replaceDepletedProducerSourceCellOutputFx";

export const readProducerPlacementSuccessEffectsFx = Effect.fn(
	"readProducerPlacementSuccessEffectsFx",
)(function* ({
	chargeOutcome,
	config,
	liveJob,
	nowMs,
	placementEvents,
	placementSave,
	save,
}: {
	chargeOutcome: ProducerChargeCompletionOutcome | undefined;
	config: GameConfig;
	liveJob: GameSaveProducerJob;
	nowMs: number;
	placementEvents: ProducerCompletionEvents;
	placementSave: GameSave;
	save: GameSave;
}) {
	if (!chargeOutcome?.removeOnDepleted) {
		return {
			chargeEvents: yield* spendProducerChargeCostAfterCompletedDeliveryFx({
				config,
				job: liveJob,
				nextSave: placementSave,
				nowMs,
			}),
			placementEvents,
		};
	}

	const producerItem = save.board.items[liveJob.itemInstanceId];
	if (!producerItem) {
		return {
			chargeEvents: [
				createProducerChargesDepletedRemovalEvent({
					job: liveJob,
					nowMs,
					producerId: chargeOutcome.producerId,
				}),
			] satisfies ProducerCompletionEvents,
			placementEvents,
		};
	}

	const replacedSource = yield* replaceDepletedProducerSourceCellOutputFx({
		events: placementEvents,
		job: liveJob,
		nextSave: placementSave,
		nowMs,
		producerItem,
	});
	if (replacedSource.replaced) {
		return {
			chargeEvents: [] satisfies ProducerCompletionEvents,
			placementEvents: replacedSource.events,
		};
	}

	yield* removeBoardItemFromSaveFx({
		itemInstanceId: liveJob.itemInstanceId,
		runtimeState: "remove",
		save: placementSave,
	});
	return {
		chargeEvents: [
			createProducerChargesDepletedRemovalEvent({
				job: liveJob,
				nowMs,
				producerId: chargeOutcome.producerId,
			}),
		] satisfies ProducerCompletionEvents,
		placementEvents: replacedSource.events,
	};
});
