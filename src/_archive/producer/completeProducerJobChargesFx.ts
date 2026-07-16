import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import {
	readLineDefinition,
	readProducerCapabilityDefinition,
} from "~/config/GameItemCapabilities";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { removeBoardItemFromSaveFx } from "~/board/removeBoardItemFromSaveFx";
import { readProducerRemainingCharges } from "~/producer/readProducerRemainingCharges";
import { writeProducerChargeStateToSaveFx } from "~/producer/writeProducerChargeStateToSaveFx";
import {
	createProducerChargesDepletedRemovalEvent,
	type ProducerCompletionEvents,
} from "~/producer/ProducerJobCompletionEvents";

export type ProducerChargeCompletionOutcome = {
	producerId: string;
	nextRemainingCharges: number;
	removeOnDepleted: boolean;
};

export const readProducerChargeCompletionOutcomeFx = Effect.fn(
	"readProducerChargeCompletionOutcomeFx",
)(function* ({
	config,
	job,
	save,
}: {
	config: GameConfig;
	job: GameSaveProducerJob;
	save: GameSave;
}) {
	const producerItem = save.board.items[job.itemInstanceId];
	if (!producerItem) return undefined;

	const producerId = producerItem.itemId;
	const producer = readProducerCapabilityDefinition({
		config,
		producerId,
	});
	const line = producer
		? readLineDefinition({
				producerDefinition: producer,
				lineId: job.lineId,
			})
		: undefined;
	if (!producer || !line || producer.charges === undefined || line.chargeCost <= 0) {
		return undefined;
	}

	const remainingCharges = readProducerRemainingCharges({
		config,
		producerId,
		itemInstanceId: job.itemInstanceId,
		save,
	});
	if (remainingCharges === undefined) return undefined;

	const nextRemainingCharges = Math.max(0, remainingCharges - line.chargeCost);

	return {
		nextRemainingCharges,
		producerId,
		removeOnDepleted: nextRemainingCharges === 0 && producer.onChargesDepleted === "remove",
	} satisfies ProducerChargeCompletionOutcome;
});

export const spendProducerChargeCostAfterCompletedDeliveryFx = Effect.fn(
	"spendProducerChargeCostAfterCompletedDeliveryFx",
)(function* ({
	config,
	job,
	nextSave,
	nowMs,
}: {
	config: GameConfig;
	job: GameSaveProducerJob;
	nextSave: GameSave;
	nowMs: number;
}) {
	const outcome = yield* readProducerChargeCompletionOutcomeFx({
		config,
		job,
		save: nextSave,
	});
	if (!outcome) return [] satisfies ProducerCompletionEvents;

	yield* writeProducerChargeStateToSaveFx({
		itemInstanceId: job.itemInstanceId,
		save: nextSave,
		state: {
			remainingCharges: outcome.nextRemainingCharges,
		},
	});

	if (!outcome.removeOnDepleted) {
		return [] satisfies ProducerCompletionEvents;
	}

	yield* removeBoardItemFromSaveFx({
		itemInstanceId: job.itemInstanceId,
		runtimeState: "remove",
		save: nextSave,
	});

	return [
		createProducerChargesDepletedRemovalEvent({
			job,
			nowMs,
			producerId: outcome.producerId,
		}),
	] satisfies ProducerCompletionEvents;
});
