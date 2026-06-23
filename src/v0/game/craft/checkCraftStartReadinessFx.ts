import { Effect } from "effect";
import { checkGameRequirementsFx } from "~/v0/game/requirements/checkGameRequirementsFx";
import { checkCraftTargetIdleFx } from "~/v0/game/craft/checkCraftTargetIdleFx";
import { readCraftBoardItemFx } from "~/v0/game/craft/readCraftBoardItemFx";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/requirements/readStoredRequirementQuantitiesFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionCraftStart } from "~/v0/game/action/GameActionCraftStart";
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

	yield* checkCraftTargetIdleFx({
		save,
		targetItemInstanceId: action.targetItemInstanceId,
	});

	const storedRequirementItems = yield* readStoredRequirementQuantitiesFx({
		save,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	yield* checkGameRequirementsFx({
		requirements: target.recipe.requirements,
		save,
		storedItems: storedRequirementItems,
		targetItemInstanceId: action.targetItemInstanceId,
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
