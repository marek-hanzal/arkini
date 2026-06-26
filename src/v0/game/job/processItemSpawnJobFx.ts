import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { placeGameSaveItemsFx } from "~/v0/game/placement/placeGameSaveItemsFx";
import { readBoardItemCell } from "~/v0/game/board/readBoardItemCell";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { isGamePlacementFailureRetryable } from "~/v0/game/placement/isGamePlacementFailureRetryable";
import type { GameEngineCompletionResult } from "~/v0/game/engine/model/GameEngineCompletionResult";
import type { GameSave, GameSaveItemSpawnJob } from "~/v0/game/engine/model/GameSaveSchema";

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
	const seedCell = readBoardItemCell({
		itemInstanceId: itemSpawnJob.originItemInstanceId,
		save,
	});
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
						failedAtMs: nowMs,
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
					blockedAtMs: nowMs,
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
		events: placement.events,
		save: placement.save,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});
