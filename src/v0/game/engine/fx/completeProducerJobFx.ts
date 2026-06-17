import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { placeGameSaveItemsFx } from "~/v0/game/engine/fx/placeGameSaveItemsFx";
import { rollLootTableItemsFx } from "~/v0/game/engine/fx/rollLootTableItemsFx";
import { scheduleGameItemSpawnsFx } from "~/v0/game/engine/fx/scheduleGameItemSpawnsFx";
import type { GameEngineCompletionResult } from "~/v0/game/engine/model/GameEngineCompletionResult";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSaveItemPlacementRequest } from "~/v0/game/engine/model/GameSaveItemPlacementRequest";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";

export namespace completeProducerJobFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		job: GameSaveProducerJob;
		nowMs: number;
	}
}

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

	if (!product.outputTableId) {
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

	yield* match(product.placement)
		.with("board_then_inventory", () => Effect.void)
		.exhaustive();

	const lootTable = config.lootTables[product.outputTableId];

	if (!lootTable) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Missing loot table "${product.outputTableId}".`,
			),
		);
	}

	const roll = yield* rollLootTableItemsFx({
		lootTable,
	});
	const placementRequests = roll.items.map(
		(item) =>
			({
				...item,
				originItemInstanceId: liveJob.producerItemInstanceId,
				reason: "product-output",
			}) satisfies GameSaveItemPlacementRequest,
	);
	const preflightPlacement = yield* placeGameSaveItemsFx({
		config,
		items: placementRequests,
		nowMs,
		save,
	});

	if (preflightPlacement.type === "blocked") {
		return {
			event: {
				blockedAtMs: nowMs,
				jobId: liveJob.id,
				producerItemInstanceId: liveJob.producerItemInstanceId,
				productId: liveJob.productId,
				reason: "placement_unavailable" as const,
				type: "product.blocked" as const,
			},
			type: "blocked" as const,
		} satisfies GameEngineCompletionResult;
	}

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	delete nextSave.producerJobs[liveJob.id];
	yield* scheduleGameItemSpawnsFx({
		dueAtMs: nowMs,
		items: placementRequests,
		save: nextSave,
	});
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
});
