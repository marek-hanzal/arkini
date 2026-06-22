import { Effect } from "effect";
import { checkGameRequirementsFx } from "~/v0/game/requirements/checkGameRequirementsFx";
import { readCraftBoardItemFx } from "~/v0/game/craft/readCraftBoardItemFx";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/requirements/readStoredRequirementQuantitiesFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionCraftStart } from "~/v0/game/action/GameActionCraftStart";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import { checkItemExclusiveOwnershipFx } from "~/v0/game/exclusivity/checkItemExclusiveOwnershipFx";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkCraftStartReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionCraftStart;
	}
}

export const checkCraftStartReadinessFx = Effect.fn("checkCraftStartReadinessFx")(function* ({
	config,
	save,
	action,
}: checkCraftStartReadinessFx.Props) {
	const target = yield* readCraftBoardItemFx({
		config,
		recipeId: action.recipeId,
		save,
		targetItemInstanceId: action.targetItemInstanceId,
	});

	const runningCraftJob = Object.values(save.craftJobs).find(
		(job) => job.targetItemInstanceId === action.targetItemInstanceId,
	);
	if (runningCraftJob) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"craft_in_progress",
				`Craft target "${action.targetItemInstanceId}" already has running craft job "${runningCraftJob.id}".`,
			),
		);
	}

	const storedRequirementItems = yield* readStoredRequirementQuantitiesFx({
		save,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	yield* checkGameRequirementsFx({
		config,
		requirements: target.recipe.requirements,
		save,
		storedItems: storedRequirementItems,
	});
	yield* checkItemExclusiveOwnershipFx({
		config,
		ignoredBoardItemInstanceIds: new Set([
			action.targetItemInstanceId,
		]),
		itemId: target.recipe.resultItemId,
		save,
	});

	return {
		recipe: target.recipe,
		targetItem: target.targetItem,
	};
});
