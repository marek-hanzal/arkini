import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/config/GameConfigTypes";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import { blockedProducerDeliveryRetryDelayMs } from "~/producer/producerDeliveryTiming";
import { readBoardItemCell } from "~/board/logic/readBoardItemCell";
import { rescheduleProducerQueueAfterBlockedDeliveryFx } from "~/producer/rescheduleProducerQueueAfterBlockedDeliveryFx";
import { isGamePlacementFailureRetryable } from "~/placement/isGamePlacementFailureRetryable";
import { readProducerJobEffectiveLineFx } from "~/producer/readProducerJobEffectiveLineFx";
import { readProducerCapabilityDefinition } from "~/config/GameItemCapabilities";
import { readLineDefinition } from "~/config/GameItemCapabilities";
import { readProducerRemainingCharges } from "~/producer/readProducerRemainingCharges";
import { removeBoardItemRuntimeState } from "~/board/logic/removeBoardItemRuntimeState";
import { rollEffectiveLootPlanItemsFx } from "~/effects/rollEffectiveLootPlanItemsFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameEngineCompletionResult } from "~/engine/model/GameEngineCompletionResult";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";
import { replaceDepletedProducerSourceCellOutput } from "~/producer/replaceDepletedProducerSourceCellOutput";

export namespace completeProducerJobFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		job: GameSaveProducerJob;
		nowMs: number;
	}
}

const createLineCompletedEvent = ({ job, nowMs }: { job: GameSaveProducerJob; nowMs: number }) => ({
	atMs: nowMs,
	jobId: job.id,
	itemInstanceId: job.itemInstanceId,
	lineId: job.lineId,
	type: "line.completed" as const,
});

type ProducerDeliveryItem = {
	itemId: string;
	quantity: number;
};

const toPlacementRequests = ({
	items,
	itemInstanceId,
}: {
	items: readonly ProducerDeliveryItem[];
	itemInstanceId: string;
}) =>
	items.map(
		(item) =>
			({
				...item,
				originItemInstanceId: itemInstanceId,
				reason: "line-output",
			}) satisfies GameSaveItemPlacementRequest,
	);

const rollProducerDeliveryItemsFx = Effect.fn("completeProducerJobFx.rollProducerDeliveryItemsFx")(
	function* ({
		config,
		job,
		nowMs,
		save,
	}: {
		config: GameConfig;
		job: GameSaveProducerJob;
		nowMs: number;
		save: GameSave;
	}) {
		const effectiveLine = yield* readProducerJobEffectiveLineFx({
			config,
			nowMs,
			itemInstanceId: job.itemInstanceId,
			lineId: job.lineId,
			save,
		});
		return (yield* rollEffectiveLootPlanItemsFx({
			config,
			lootPlan: effectiveLine.lootPlan,
		})).items;
	},
);

type ProducerChargeCompletionOutcome = {
	producerId: string;
	nextRemainingCharges: number;
	removeOnDepleted: boolean;
};

const readProducerChargeCompletionOutcome = ({
	config,
	job,
	save,
}: {
	config: GameConfig;
	job: GameSaveProducerJob;
	save: GameSave;
}): ProducerChargeCompletionOutcome | undefined => {
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
	};
};

const createProducerChargesDepletedRemovalEvent = ({
	job,
	nowMs,
	producerId,
}: {
	job: GameSaveProducerJob;
	nowMs: number;
	producerId: string;
}) => ({
	atMs: nowMs,
	itemId: producerId,
	itemInstanceId: job.itemInstanceId,
	reason: "producer-depleted" as const,
	type: "item.removed" as const,
});

const spendProducerChargeCostAfterCompletedDelivery = ({
	config,
	job,
	nextSave,
	nowMs,
}: {
	config: GameConfig;
	job: GameSaveProducerJob;
	nextSave: GameSave;
	nowMs: number;
}) => {
	const outcome = readProducerChargeCompletionOutcome({
		config,
		job,
		save: nextSave,
	});
	if (!outcome) return [] satisfies GameEngineCompletionResult["events"];

	nextSave.producerCharges[job.itemInstanceId] = {
		remainingCharges: outcome.nextRemainingCharges,
	};

	if (!outcome.removeOnDepleted) {
		return [] satisfies GameEngineCompletionResult["events"];
	}

	delete nextSave.board.items[job.itemInstanceId];
	removeBoardItemRuntimeState({
		itemInstanceId: job.itemInstanceId,
		save: nextSave,
	});

	return [
		createProducerChargesDepletedRemovalEvent({
			job,
			nowMs,
			producerId: outcome.producerId,
		}),
	] satisfies GameEngineCompletionResult["events"];
};

const rescheduleQueueAfterCompletedDeliveryFx = Effect.fn(
	"completeProducerJobFx.rescheduleQueueAfterCompletedDeliveryFx",
)(function* ({
	config,
	liveJob,
	nextSave,
	nowMs,
}: {
	config: GameConfig;
	liveJob: GameSaveProducerJob;
	nextSave: GameSave;
	nowMs: number;
}) {
	if (!liveJob.delivery) return;

	yield* rescheduleProducerQueueAfterBlockedDeliveryFx({
		blockedJobId: liveJob.id,
		config,
		nextSave,
		itemInstanceId: liveJob.itemInstanceId,
		resumeAtMs: nowMs,
	});
});

export const completeProducerJobFx = Effect.fn("completeProducerJobFx")(function* ({
	config,
	save,
	job,
	nowMs,
}: completeProducerJobFx.Props) {
	const liveJob = save.producerJobs[job.id];

	if (!liveJob) {
		return {
			events: [],
			save,
			type: "completed" as const,
		} satisfies GameEngineCompletionResult;
	}

	const producerItem = save.board.items[liveJob.itemInstanceId];
	const producer = producerItem
		? readProducerCapabilityDefinition({
				config,
				producerId: producerItem.itemId,
			})
		: undefined;
	const line = producer
		? readLineDefinition({
				producerDefinition: producer,
				lineId: liveJob.lineId,
			})
		: undefined;
	if (!line) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing line "${liveJob.lineId}".`),
		);
	}

	const placement = line.placement;
	yield* match(placement)
		.with("board_then_inventory", () => Effect.void)
		.exhaustive();

	const deliveryItems = yield* rollProducerDeliveryItemsFx({
		config,
		job: liveJob,
		nowMs,
		save,
	});

	if (deliveryItems.length === 0) {
		const nextSave = yield* cloneGameSaveFx({
			save,
		});
		delete nextSave.producerJobs[liveJob.id];
		const chargeEvents = spendProducerChargeCostAfterCompletedDelivery({
			config,
			job: liveJob,
			nextSave,
			nowMs,
		});
		yield* rescheduleQueueAfterCompletedDeliveryFx({
			config,
			liveJob,
			nextSave,
			nowMs,
		});
		nextSave.updatedAtMs = nowMs;

		return {
			events: [
				createLineCompletedEvent({
					job: liveJob,
					nowMs,
				}),
				...chargeEvents,
			],
			save: nextSave,
			type: "completed" as const,
		} satisfies GameEngineCompletionResult;
	}

	const placementRequests = toPlacementRequests({
		items: deliveryItems,
		itemInstanceId: liveJob.itemInstanceId,
	});
	const seedCell = readBoardItemCell({
		itemInstanceId: liveJob.itemInstanceId,
		save,
	});
	const chargeOutcome = readProducerChargeCompletionOutcome({
		config,
		job: liveJob,
		save,
	});
	const freedBoardItemInstanceIds = chargeOutcome?.removeOnDepleted
		? new Set([
				liveJob.itemInstanceId,
			])
		: undefined;
	const placementEither = yield* Effect.either(
		placeGameSaveItemsFx({
			config,
			freedBoardItemInstanceIds,
			items: placementRequests,
			nowMs,
			save,
			seedCell,
		}),
	);

	if (placementEither._tag === "Left") {
		const error = placementEither.left;
		if (error._tag !== "GamePlacementFailed") {
			return yield* Effect.fail(error);
		}

		const nextSave = yield* cloneGameSaveFx({
			save,
		});

		if (!isGamePlacementFailureRetryable(error.reason)) {
			delete nextSave.producerJobs[liveJob.id];
			yield* rescheduleQueueAfterCompletedDeliveryFx({
				config,
				liveJob,
				nextSave,
				nowMs,
			});
			nextSave.updatedAtMs = nowMs;

			return {
				events: [
					createLineCompletedEvent({
						job: liveJob,
						nowMs,
					}),
					{
						atMs: nowMs,
						jobId: liveJob.id,
						itemInstanceId: liveJob.itemInstanceId,
						lineId: liveJob.lineId,
						reason: error.reason,
						type: "line.failed" as const,
					},
				],
				save: nextSave,
				type: "completed" as const,
			} satisfies GameEngineCompletionResult;
		}

		const nextAttemptAtMs = nowMs + blockedProducerDeliveryRetryDelayMs;
		nextSave.producerJobs[liveJob.id] = {
			...liveJob,
			delivery: {
				lastBlockedAtMs: nowMs,
				nextAttemptAtMs,
			},
		};
		yield* rescheduleProducerQueueAfterBlockedDeliveryFx({
			blockedJobId: liveJob.id,
			config,
			nextSave,
			itemInstanceId: liveJob.itemInstanceId,
			resumeAtMs: nextAttemptAtMs,
		});
		nextSave.updatedAtMs = nowMs;

		return {
			events:
				liveJob.delivery?.lastBlockedAtMs === undefined
					? [
							{
								atMs: nowMs,
								jobId: liveJob.id,
								itemInstanceId: liveJob.itemInstanceId,
								lineId: liveJob.lineId,
								reason: error.reason,
								type: "line.blocked" as const,
							},
						]
					: [],
			save: nextSave,
			type: "blocked" as const,
		} satisfies GameEngineCompletionResult;
	}

	const placementResult = placementEither.right;
	delete placementResult.save.producerJobs[liveJob.id];
	let placementEvents = placementResult.events;
	let chargeEvents: GameEngineCompletionResult["events"];
	if (chargeOutcome?.removeOnDepleted) {
		const producerItem = save.board.items[liveJob.itemInstanceId];
		if (!producerItem) {
			chargeEvents = [
				createProducerChargesDepletedRemovalEvent({
					job: liveJob,
					nowMs,
					producerId: chargeOutcome.producerId,
				}),
			];
		} else {
			const replacedSource = yield* replaceDepletedProducerSourceCellOutput({
				events: placementEvents,
				job: liveJob,
				nextSave: placementResult.save,
				nowMs,
				producerItem,
			});
			placementEvents = replacedSource.events;
			if (!replacedSource.replaced) {
				delete placementResult.save.board.items[liveJob.itemInstanceId];
				removeBoardItemRuntimeState({
					itemInstanceId: liveJob.itemInstanceId,
					save: placementResult.save,
				});
			}
			chargeEvents = replacedSource.replaced
				? []
				: [
						createProducerChargesDepletedRemovalEvent({
							job: liveJob,
							nowMs,
							producerId: chargeOutcome.producerId,
						}),
					];
		}
	} else {
		chargeEvents = spendProducerChargeCostAfterCompletedDelivery({
			config,
			job: liveJob,
			nextSave: placementResult.save,
			nowMs,
		});
	}
	yield* rescheduleQueueAfterCompletedDeliveryFx({
		config,
		liveJob,
		nextSave: placementResult.save,
		nowMs,
	});
	placementResult.save.updatedAtMs = nowMs;

	return {
		events: [
			createLineCompletedEvent({
				job: liveJob,
				nowMs,
			}),
			...chargeEvents,
			...placementEvents,
		],
		save: placementResult.save,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});
