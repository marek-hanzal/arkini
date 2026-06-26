import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { placeGameSaveItemsFx } from "~/v0/game/placement/placeGameSaveItemsFx";
import { blockedProducerDeliveryRetryDelayMs } from "~/v0/game/producer/producerDeliveryTiming";
import { readBoardItemCell } from "~/v0/game/board/readBoardItemCell";
import { isGamePlacementFailureRetryable } from "~/v0/game/placement/isGamePlacementFailureRetryable";
import { readProductFx } from "~/v0/game/producer/readProductFx";
import type { GameEngineCompletionResult } from "~/v0/game/engine/model/GameEngineCompletionResult";
import type { GameSaveItemPlacementRequest } from "~/v0/game/placement/GameSaveItemPlacementRequest";
import { readEffectiveProducerProductLine } from "~/v0/game/effects/readEffectiveProducerProductLine";
import { readProducerProductDurationMs } from "~/v0/game/producer/readProducerProductDurationMs";
import { resolveGameRequirements } from "~/v0/game/requirements/resolveGameRequirements";
import { rollEffectiveLootPlanItemsFx } from "~/v0/game/effects/rollEffectiveLootPlanItemsFx";
import type {
	GameSave,
	GameSaveProducerDeliveryItem,
	GameSaveProducerJob,
} from "~/v0/game/engine/model/GameSaveSchema";

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

const toPlacementRequests = ({
	items,
	producerItemInstanceId,
}: {
	items: readonly GameSaveProducerDeliveryItem[];
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

	const product = yield* readProductFx({
		productId: liveJob.productId,
	});
	const placement = liveJob.placement ?? product.placement;
	yield* match(placement)
		.with("board_then_inventory", () => Effect.void)
		.exhaustive();

	const producerBoardItem = save.board.items[liveJob.producerItemInstanceId];
	const producerId = producerBoardItem?.itemId ?? "";
	const producerDefinition = producerId ? config.producers[producerId] : undefined;
	const requirements = resolveGameRequirements({
		config,
		requirementIds: [
			...(producerDefinition?.requirementIds ?? []),
			...product.requirementIds,
		],
	});
	const hindrances = [
		...(producerDefinition?.hinderedBy ?? []),
		...(product.hinderedBy ?? []),
	];
	const effectiveProductLine = readEffectiveProducerProductLine({
		baseDurationMs: readProducerProductDurationMs({
			hindrances,
			product,
			producerItemInstanceId: liveJob.producerItemInstanceId,
			requirements,
			save,
		}),
		config,
		nowMs,
		producerId,
		producerItemId: producerBoardItem?.itemId ?? "",
		producerItemInstanceId: liveJob.producerItemInstanceId,
		product,
		productId: liveJob.productId,
		save,
	});

	if (
		effectiveProductLine.lootPlan.baseOutput.length === 0 &&
		effectiveProductLine.lootPlan.appendOutputs.length === 0 &&
		effectiveProductLine.lootPlan.chanceItems.length === 0
	) {
		const nextSave = yield* cloneGameSaveFx({
			save,
		});
		delete nextSave.producerJobs[liveJob.id];
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

	const deliveryItems =
		liveJob.delivery?.items ??
		(yield* rollEffectiveLootPlanItemsFx({
			config,
			lootPlan: effectiveProductLine.lootPlan,
		})).items;

	if (deliveryItems.length === 0) {
		const nextSave = yield* cloneGameSaveFx({
			save,
		});
		delete nextSave.producerJobs[liveJob.id];
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

		nextSave.producerJobs[liveJob.id] = {
			...liveJob,
			delivery: {
				items: deliveryItems,
				lastBlockedAtMs: nowMs,
				nextAttemptAtMs: nowMs + blockedProducerDeliveryRetryDelayMs,
			},
		};
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
