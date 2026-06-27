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
import { rollEffectiveLootPlanItemsFx } from "~/v0/game/effects/rollEffectiveLootPlanItemsFx";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineCompletionResult } from "~/v0/game/engine/model/GameEngineCompletionResult";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import type { GameSaveItemPlacementRequest } from "~/v0/game/placement/GameSaveItemPlacementRequest";

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
	const placementEither = yield* Effect.either(
		placeGameSaveItemsFx({
			config,
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
			...placementResult.events,
		],
		save: placementResult.save,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});
