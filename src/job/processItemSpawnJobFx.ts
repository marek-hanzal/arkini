import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import { readBoardItemCellFx } from "~/board/logic/readBoardItemCellFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { isGamePlacementFailureRetryable } from "~/placement/isGamePlacementFailureRetryable";
import type { GameEngineCompletionResult } from "~/engine/model/GameEngineCompletionResult";
import type { GameSave, GameSaveItemSpawnJob } from "~/engine/model/GameSaveSchema";

export namespace processItemSpawnJobFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		itemSpawnJob: Extract<
			GameSaveItemSpawnJob,
			{
				type: "item.spawn";
			}
		>;
		nowMs: number;
	}
}

export const processItemSpawnJobFx = Effect.fn("processItemSpawnJobFx")(function* ({
	config,
	save,
	itemSpawnJob,
	nowMs,
}: processItemSpawnJobFx.Props) {
	const seedCell =
		itemSpawnJob.seedCell ??
		(yield* readBoardItemCellFx({
			itemInstanceId: itemSpawnJob.originItemInstanceId,
			save,
		}));
	const placementEither = yield* Effect.either(
		placeGameSaveItemsFx({
			config,
			items: [
				{
					itemId: itemSpawnJob.itemId,
					originItemInstanceId: itemSpawnJob.originItemInstanceId,
					quantity: itemSpawnJob.quantity,
					reason: itemSpawnJob.reason,
				},
			],
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

		if (!isGamePlacementFailureRetryable(error.reason)) {
			const nextSave = yield* cloneGameSaveFx({
				save,
			});
			delete nextSave.itemSpawnJobs[itemSpawnJob.id];
			nextSave.updatedAtMs = nowMs;

			return {
				events: [
					{
						atMs: nowMs,
						itemId: itemSpawnJob.itemId,
						reason: error.reason,
						jobId: itemSpawnJob.id,
						type: "item.spawn.failed" as const,
					},
				],
				save: nextSave,
				type: "completed" as const,
			} satisfies GameEngineCompletionResult;
		}

		return {
			events: [
				{
					atMs: nowMs,
					itemId: itemSpawnJob.itemId,
					reason: error.reason,
					jobId: itemSpawnJob.id,
					type: "item.spawn.blocked" as const,
				},
			],
			save,
			type: "blocked" as const,
		} satisfies GameEngineCompletionResult;
	}

	const placement = placementEither.right;
	delete placement.save.itemSpawnJobs[itemSpawnJob.id];
	placement.save.updatedAtMs = nowMs;

	return {
		events: placement.events.map((event) =>
			event.type === "item.created"
				? {
						...event,
						spawnJobId: itemSpawnJob.id,
						spawnSequenceIndex: itemSpawnJob.sequenceIndex,
					}
				: event,
		),
		save: placement.save,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});
