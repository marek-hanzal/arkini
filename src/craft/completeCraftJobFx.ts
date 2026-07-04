import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { readCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import { readBoardItemMaxCountCapacity } from "~/board/logic/readBoardItemMaxCountCapacity";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { isGamePlacementFailureRetryable } from "~/placement/isGamePlacementFailureRetryable";
import { blockedCraftCompletionRetryDelayMs } from "~/craft/craftCompletionTiming";
import { removeBoardItemRuntimeStateFx } from "~/board/logic/removeBoardItemRuntimeStateFx";
import type { GameEngineCompletionResult } from "~/engine/model/GameEngineCompletionResult";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GamePlacementFailureReason } from "~/placement/GamePlacementFailureReasonSchema";
import type { GameSave, GameSaveCraftJob } from "~/engine/model/GameSaveSchema";

export namespace completeCraftJobFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		job: GameSaveCraftJob;
		nowMs: number;
	}
}

const completeBlockedCraftJobFx = Effect.fn("completeCraftJobFx.completeBlockedCraftJobFx")(
	function* ({
		reason,
		save,
		job,
		nowMs,
	}: {
		reason: GamePlacementFailureReason;
		save: GameSave;
		job: GameSaveCraftJob;
		nowMs: number;
	}) {
		const nextSave = yield* cloneGameSaveFx({
			save,
		});

		if (!isGamePlacementFailureRetryable(reason)) {
			delete nextSave.craftJobs[job.id];
			nextSave.updatedAtMs = nowMs;

			return {
				events: [
					{
						atMs: nowMs,
						jobId: job.id,
						reason,
						recipeId: job.recipeId,
						targetItemInstanceId: job.targetItemInstanceId,
						type: "craft.failed" as const,
					},
				],
				save: nextSave,
				type: "completed" as const,
			} satisfies GameEngineCompletionResult;
		}

		const nextAttemptAtMs = nowMs + blockedCraftCompletionRetryDelayMs;
		nextSave.craftJobs[job.id] = {
			...job,
			delivery: {
				lastBlockedAtMs: nowMs,
				nextAttemptAtMs,
			},
		};
		nextSave.updatedAtMs = nowMs;

		return {
			events:
				job.delivery?.lastBlockedAtMs === undefined
					? [
							{
								atMs: nowMs,
								jobId: job.id,
								reason,
								recipeId: job.recipeId,
								targetItemInstanceId: job.targetItemInstanceId,
								type: "craft.blocked" as const,
							},
						]
					: [],
			save: nextSave,
			type: "blocked" as const,
		} satisfies GameEngineCompletionResult;
	},
);

export const completeCraftJobFx = Effect.fn("completeCraftJobFx")(function* ({
	config,
	save,
	job,
	nowMs,
}: completeCraftJobFx.Props) {
	const liveJob = save.craftJobs[job.id];

	if (!liveJob) {
		return {
			events: [],
			save,
			type: "completed" as const,
		} satisfies GameEngineCompletionResult;
	}

	const recipe = readCraftRecipeDefinition({
		config,
		recipeId: liveJob.recipeId,
	});

	if (!recipe) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing craft recipe "${liveJob.recipeId}".`),
		);
	}

	const liveTarget = save.board.items[liveJob.targetItemInstanceId];
	if (!liveTarget) {
		return yield* Effect.fail(
			GameEngineError.saveInvalid(
				`Craft job "${liveJob.id}" target "${liveJob.targetItemInstanceId}" is missing.`,
			),
		);
	}

	if (liveTarget.itemId !== liveJob.recipeId) {
		return yield* Effect.fail(
			GameEngineError.saveInvalid(
				`Craft job "${liveJob.id}" target "${liveJob.targetItemInstanceId}" no longer matches recipe "${liveJob.recipeId}".`,
			),
		);
	}

	if (!config.items[recipe.resultItemId]) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Missing craft result item "${recipe.resultItemId}".`,
			),
		);
	}

	if (
		!isItemStorageAllowed({
			config,
			itemId: recipe.resultItemId,
			location: "board",
		})
	) {
		return yield* completeBlockedCraftJobFx({
			job: liveJob,
			nowMs,
			reason: "storage:inventory-forbidden",
			save,
		});
	}

	if (
		readBoardItemMaxCountCapacity({
			config,
			ignoredBoardItemInstanceIds: new Set([
				liveJob.targetItemInstanceId,
			]),
			itemId: recipe.resultItemId,
			save,
		}) <= 0
	) {
		return yield* completeBlockedCraftJobFx({
			job: liveJob,
			nowMs,
			reason: "board:max-count",
			save,
		});
	}

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const nextTarget = nextSave.board.items[liveJob.targetItemInstanceId];
	if (!nextTarget) {
		return yield* Effect.fail(
			GameEngineError.saveInvalid(
				`Craft job "${liveJob.id}" target "${liveJob.targetItemInstanceId}" disappeared during completion.`,
			),
		);
	}

	delete nextSave.craftJobs[liveJob.id];
	yield* removeBoardItemRuntimeStateFx({
		itemInstanceId: liveJob.targetItemInstanceId,
		save: nextSave,
	});
	if (config.items[recipe.resultItemId]?.effects?.length) {
		nextTarget.createdAtMs = nowMs;
	} else {
		delete nextTarget.createdAtMs;
	}
	nextTarget.itemId = recipe.resultItemId;
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			{
				atMs: nowMs,
				jobId: liveJob.id,
				recipeId: liveJob.recipeId,
				targetItemInstanceId: liveJob.targetItemInstanceId,
				type: "craft.completed" as const,
			},
			{
				fromItemId: liveTarget.itemId,
				itemInstanceId: liveJob.targetItemInstanceId,
				reason: "craft-result" as const,
				atMs: nowMs,
				toItemId: recipe.resultItemId,
				type: "item.replaced" as const,
			},
		],
		save: nextSave,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});
