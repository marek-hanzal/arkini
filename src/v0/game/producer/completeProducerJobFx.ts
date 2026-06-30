import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { placeGameSaveItemsFx } from "~/v0/game/placement/placeGameSaveItemsFx";
import { blockedProducerDeliveryRetryDelayMs } from "~/v0/game/producer/producerDeliveryTiming";
import { readBoardItemCell } from "~/v0/game/board/readBoardItemCell";
import { rescheduleProducerQueueAfterBlockedDeliveryFx } from "~/v0/game/producer/rescheduleProducerQueueAfterBlockedDeliveryFx";
import { isGamePlacementFailureRetryable } from "~/v0/game/placement/isGamePlacementFailureRetryable";
import { readProducerJobEffectiveProductLineFx } from "~/v0/game/producer/readProducerJobEffectiveProductLineFx";
import { readProducerCapabilityDefinition } from "~/v0/game/config/readProducerCapabilityDefinition";
import { readProducerRemainingCharges } from "~/v0/game/producer/readProducerRemainingCharges";
import { removeBoardItemRuntimeState } from "~/v0/game/board/removeBoardItemRuntimeState";
import { rollEffectiveLootPlanItemsFx } from "~/v0/game/effects/rollEffectiveLootPlanItemsFx";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineCompletionResult } from "~/v0/game/engine/model/GameEngineCompletionResult";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import type { GameSaveItemPlacementRequest } from "~/v0/game/placement/GameSaveItemPlacementRequest";
import { replaceDepletedProducerSourceCellOutput } from "~/v0/game/producer/replaceDepletedProducerSourceCellOutput";

export namespace completeProducerJobFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		job: GameSaveProducerJob;
		nowMs: number;
	}
}

const createProductCompletedEvent = ({
	job,
	nowMs,
}: {
	job: GameSaveProducerJob;
	nowMs: number;
}) => ({
	atMs: nowMs,
	jobId: job.id,
	producerItemInstanceId: job.producerItemInstanceId,
	productId: job.productId,
	type: "product.completed" as const,
});

type ProducerDeliveryItem = {
	itemId: string;
	quantity: number;
};

const toPlacementRequests = ({
	items,
	producerItemInstanceId,
}: {
	items: readonly ProducerDeliveryItem[];
	producerItemInstanceId: string;
}) =>
	items.map(
		(item) =>
			({
				...item,
				originItemInstanceId: producerItemInstanceId,
				reason: "product-output",
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
		const effectiveProductLine = yield* readProducerJobEffectiveProductLineFx({
			config,
			nowMs,
			producerItemInstanceId: job.producerItemInstanceId,
			productId: job.productId,
			save,
		});
		return (yield* rollEffectiveLootPlanItemsFx({
			config,
			lootPlan: effectiveProductLine.lootPlan,
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
	const producerItem = save.board.items[job.producerItemInstanceId];
	if (!producerItem) return undefined;

	const producerId = producerItem.itemId;
	const producer = readProducerCapabilityDefinition({
		config,
		producerId,
	});
	const product = config.products[job.productId];
	if (!producer || !product || producer.charges === undefined || product.chargeCost <= 0) {
		return undefined;
	}

	const remainingCharges = readProducerRemainingCharges({
		config,
		producerId,
		producerItemInstanceId: job.producerItemInstanceId,
		save,
	});
	if (remainingCharges === undefined) return undefined;

	const nextRemainingCharges = Math.max(0, remainingCharges - product.chargeCost);

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
	itemInstanceId: job.producerItemInstanceId,
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

	nextSave.producerCharges[job.producerItemInstanceId] = {
		remainingCharges: outcome.nextRemainingCharges,
	};

	if (!outcome.removeOnDepleted) {
		return [] satisfies GameEngineCompletionResult["events"];
	}

	delete nextSave.board.items[job.producerItemInstanceId];
	removeBoardItemRuntimeState({
		itemInstanceId: job.producerItemInstanceId,
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
		producerItemInstanceId: liveJob.producerItemInstanceId,
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

	const product = config.products[liveJob.productId];
	if (!product) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing product "${liveJob.productId}".`),
		);
	}

	const placement = product.placement;
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
				createProductCompletedEvent({
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
		producerItemInstanceId: liveJob.producerItemInstanceId,
	});
	const seedCell = readBoardItemCell({
		itemInstanceId: liveJob.producerItemInstanceId,
		save,
	});
	const chargeOutcome = readProducerChargeCompletionOutcome({
		config,
		job: liveJob,
		save,
	});
	const freedBoardItemInstanceIds = chargeOutcome?.removeOnDepleted
		? new Set([
				liveJob.producerItemInstanceId,
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
					createProductCompletedEvent({
						job: liveJob,
						nowMs,
					}),
					{
						atMs: nowMs,
						jobId: liveJob.id,
						producerItemInstanceId: liveJob.producerItemInstanceId,
						productId: liveJob.productId,
						reason: error.reason,
						type: "product.failed" as const,
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
			producerItemInstanceId: liveJob.producerItemInstanceId,
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
								producerItemInstanceId: liveJob.producerItemInstanceId,
								productId: liveJob.productId,
								reason: error.reason,
								type: "product.blocked" as const,
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
		const producerItem = save.board.items[liveJob.producerItemInstanceId];
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
				delete placementResult.save.board.items[liveJob.producerItemInstanceId];
				removeBoardItemRuntimeState({
					itemInstanceId: liveJob.producerItemInstanceId,
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
			createProductCompletedEvent({
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
