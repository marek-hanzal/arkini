import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { placeGameSaveItemsFx } from "~/v0/game/placement/placeGameSaveItemsFx";
import { blockedProducerDeliveryRetryDelayMs } from "~/v0/game/producer/producerDeliveryTiming";
import { readBoardItemCell } from "~/v0/game/board/readBoardItemCell";
import { readProductFx } from "~/v0/game/producer/readProductFx";
import { rollLootTableItemsFx } from "~/v0/game/loot/rollLootTableItemsFx";
import type { GameEngineCompletionResult } from "~/v0/game/engine/model/GameEngineCompletionResult";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSaveItemPlacementRequest } from "~/v0/game/placement/GameSaveItemPlacementRequest";
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
	const outputTableId = liveJob.outputTableId;
	const placement = liveJob.placement ?? product.placement;

	if (!outputTableId) {
		const nextSave = yield* cloneGameSaveFx({
			save,
		});
		delete nextSave.producerJobs[liveJob.id];
		nextSave.updatedAtMs = nowMs;

		return {
			events: [
				{
					completedAtMs: nowMs,
					jobId: liveJob.id,
					producerItemInstanceId: liveJob.producerItemInstanceId,
					productId: liveJob.productId,
					type: "product.completed" as const,
				},
			],
			save: nextSave,
			type: "completed" as const,
		} satisfies GameEngineCompletionResult;
	}

	yield* match(placement)
		.with("board_then_inventory", () => Effect.void)
		.exhaustive();

	const lootTable = config.lootTables[outputTableId];

	if (!lootTable) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing loot table "${outputTableId}".`),
		);
	}

	const deliveryItems =
		liveJob.delivery?.items ??
		(yield* rollLootTableItemsFx({
			lootTable,
		})).items;

	if (deliveryItems.length === 0) {
		const nextSave = yield* cloneGameSaveFx({
			save,
		});
		delete nextSave.producerJobs[liveJob.id];
		nextSave.updatedAtMs = nowMs;

		return {
			events: [
				{
					completedAtMs: nowMs,
					jobId: liveJob.id,
					producerItemInstanceId: liveJob.producerItemInstanceId,
					productId: liveJob.productId,
					type: "product.completed" as const,
				},
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
		nextSave.producerJobs[liveJob.id] = {
			...liveJob,
			delivery: {
				items: deliveryItems,
				lastBlockedAtMs: nowMs,
				retryAtMs: nowMs + blockedProducerDeliveryRetryDelayMs,
			},
		};
		nextSave.updatedAtMs = nowMs;

		return {
			events:
				liveJob.delivery?.lastBlockedAtMs === undefined
					? [
							{
								blockedAtMs: nowMs,
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
			{
				completedAtMs: nowMs,
				jobId: liveJob.id,
				producerItemInstanceId: liveJob.producerItemInstanceId,
				productId: liveJob.productId,
				type: "product.completed" as const,
			},
			...placementResult.events,
		],
		save: placementResult.save,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});
