import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readBoardItemMaxCountCapacity } from "~/v0/game/board/readBoardItemMaxCountCapacity";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { isItemStorageAllowed } from "~/v0/game/config/isItemStorageAllowed";
import { readGameEffectItemCreateBlockReasons } from "~/v0/game/effects/readGameEffectItemCreateBlockReasons";
import { removeBoardItemRuntimeState } from "~/v0/game/board/removeBoardItemRuntimeState";
import type { GameEngineCompletionResult } from "~/v0/game/engine/model/GameEngineCompletionResult";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GamePlacementFailureReason } from "~/v0/game/placement/GamePlacementFailureReasonSchema";
import type { GameSave, GameSaveCraftJob } from "~/v0/game/engine/model/GameSaveSchema";

export namespace completeCraftJobFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		job: GameSaveCraftJob;
		nowMs: number;
	}
}

const failCraftJobFx = Effect.fn("completeCraftJobFx.failCraftJobFx")(function* ({
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
});

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

	const recipe = config.craftRecipes[liveJob.recipeId];

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
		return yield* failCraftJobFx({
			job: liveJob,
			nowMs,
			reason: "storage:inventory-forbidden",
			save,
		});
	}

	const effectBlocks = readGameEffectItemCreateBlockReasons({
		config,
		itemId: recipe.resultItemId,
		nowMs,
		save,
		targetCell: {
			x: liveTarget.x,
			y: liveTarget.y,
		},
	});
	if (effectBlocks.length > 0) {
		return yield* failCraftJobFx({
			job: liveJob,
			nowMs,
			reason: "effect:block-create",
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
		return yield* failCraftJobFx({
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
	removeBoardItemRuntimeState({
		itemInstanceId: liveJob.targetItemInstanceId,
		save: nextSave,
	});
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
