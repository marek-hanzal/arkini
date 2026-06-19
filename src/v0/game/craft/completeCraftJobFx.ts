import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { removeBoardItemRuntimeState } from "~/v0/game/board/removeBoardItemRuntimeState";
import type { GameEngineCompletionResult } from "~/v0/game/engine/model/GameEngineCompletionResult";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave, GameSaveCraftJob } from "~/v0/game/engine/model/GameSaveSchema";

export namespace completeCraftJobFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		job: GameSaveCraftJob;
		nowMs: number;
	}
}

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

	const targetDefinition = config.items[liveTarget.itemId];
	if (targetDefinition?.craftRecipeId !== liveJob.recipeId) {
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
				completedAtMs: nowMs,
				jobId: liveJob.id,
				recipeId: liveJob.recipeId,
				targetItemInstanceId: liveJob.targetItemInstanceId,
				type: "craft.completed" as const,
			},
			{
				fromItemId: liveTarget.itemId,
				itemInstanceId: liveJob.targetItemInstanceId,
				reason: "craft-result" as const,
				replacedAtMs: nowMs,
				toItemId: recipe.resultItemId,
				type: "item.replaced" as const,
			},
		],
		save: nextSave,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});
