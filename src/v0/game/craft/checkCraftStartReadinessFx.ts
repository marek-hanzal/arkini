import { Effect } from "effect";
import { checkCraftTargetIdleFx } from "~/v0/game/craft/checkCraftTargetIdleFx";
import { readCraftBoardItemFx } from "~/v0/game/craft/readCraftBoardItemFx";
import { checkGameEffectGrantSelectorFx } from "~/v0/game/effects/checkGameEffectGrantSelectorFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionCraftStart } from "~/v0/game/action/GameActionCraftStart";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkCraftStartReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionCraftStart;
	}
}

export const checkCraftStartReadinessFx = Effect.fn("checkCraftStartReadinessFx")(function* ({
	config,
	nowMs,
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

	yield* checkGameEffectGrantSelectorFx({
		config,
		missingReason: `Craft recipe "${action.recipeId}" is missing a required effect grant.`,
		nowMs,
		save,
		selector: target.recipe.grantSelector,
		target: {
			kind: "craftRecipe",
			craftRecipeId: action.recipeId,
			targetCell: target.targetItem,
		},
	});
	return {
		recipe: target.recipe,
		targetItem: target.targetItem,
	};
});
