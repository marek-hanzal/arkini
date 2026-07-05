import { Effect } from "effect";
import { removeBoardItemFromSaveFx } from "~/board/removeBoardItemFromSaveFx";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import {
	createProducerChargesDepletedRemovalEvent,
	type ProducerCompletionEvents,
} from "~/producer/ProducerJobCompletionEvents";
import type { ProducerChargeCompletionOutcome } from "~/producer/completeProducerJobChargesFx";
import { spendProducerChargeCostAfterCompletedDeliveryFx } from "~/producer/completeProducerJobChargesFx";
import type { ProducerJobCompletionScope } from "~/producer/ProducerJobCompletionTypes";
import { replaceDepletedProducerSourceCellOutputFx } from "~/producer/replaceDepletedProducerSourceCellOutputFx";

export const readProducerPlacementSuccessEffectsFx = Effect.fn(
	"readProducerPlacementSuccessEffectsFx",
)(function* ({
	chargeOutcome,
	liveJob,
	placementEvents,
	placementSave,
	scope,
}: {
	chargeOutcome: ProducerChargeCompletionOutcome | undefined;
	liveJob: GameSaveProducerJob;
	placementEvents: ProducerCompletionEvents;
	placementSave: GameSave;
	scope: ProducerJobCompletionScope;
}) {
	const { nowMs, save } = scope;
	if (!chargeOutcome?.removeOnDepleted) {
		return {
			chargeEvents: yield* spendProducerChargeCostAfterCompletedDeliveryFx({
				config: scope.config,
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
