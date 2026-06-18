import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { placeGameSaveItemsFx } from "~/v0/game/engine/fx/placeGameSaveItemsFx";
import { readBoardItemCell } from "~/v0/game/engine/fx/readBoardItemCell";
import { scheduleGameItemSpawnsFx } from "~/v0/game/engine/fx/scheduleGameItemSpawnsFx";
import type { GameEngineCompletionResult } from "~/v0/game/engine/model/GameEngineCompletionResult";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSaveItemPlacementRequest } from "~/v0/game/engine/model/GameSaveItemPlacementRequest";
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

	const seedCell = readBoardItemCell({
		itemInstanceId: liveJob.targetItemInstanceId,
		save,
	});

	const placementRequests: GameSaveItemPlacementRequest[] = [
		...liveJob.returnItems.map(
			(item) =>
				({
					...item,
					reason: "craft-requirement-return",
				}) satisfies GameSaveItemPlacementRequest,
		),
		{
			itemId: recipe.resultItemId,
			quantity: 1,
			reason: "craft-output",
		},
	];
	const preflightPlacement = yield* placeGameSaveItemsFx({
		config,
		items: placementRequests,
		nowMs,
		save,
		seedCell,
	});

	if (preflightPlacement.type === "blocked") {
		return {
			event: {
				blockedAtMs: nowMs,
				jobId: liveJob.id,
				reason: "placement_unavailable" as const,
				recipeId: liveJob.recipeId,
				targetItemInstanceId: liveJob.targetItemInstanceId,
				type: "craft.blocked" as const,
			},
			type: "blocked" as const,
		} satisfies GameEngineCompletionResult;
	}

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	delete nextSave.craftJobs[liveJob.id];
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
				recipeId: liveJob.recipeId,
				targetItemInstanceId: liveJob.targetItemInstanceId,
				type: "craft.completed" as const,
			},
		],
		save: nextSave,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});
