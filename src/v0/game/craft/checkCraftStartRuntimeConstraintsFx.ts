import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { checkItemCreateBlockedByEffectsFx } from "~/v0/game/effects/checkItemCreateBlockedByEffectsFx";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import { readBoardItemMaxCountCapacity } from "~/v0/game/board/readBoardItemMaxCountCapacity";
import { checkGameEffectGrantSelectorFx } from "~/v0/game/effects/checkGameEffectGrantSelectorFx";

export namespace checkCraftStartRuntimeConstraintsFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		recipe: GameConfig["craftRecipes"][string];
		save: GameSave;
		targetItem: GameSaveBoardItem;
		targetItemInstanceId: string;
	}
}

export const checkCraftStartRuntimeConstraintsFx = Effect.fn("checkCraftStartRuntimeConstraintsFx")(
	function* ({
		config,
		nowMs,
		recipe,
		save,
		targetItem,
		targetItemInstanceId,
	}: checkCraftStartRuntimeConstraintsFx.Props) {
		yield* checkGameEffectGrantSelectorFx({
			config,
			missingReason: `Craft recipe for "${targetItem.itemId}" is missing a required effect grant.`,
			nowMs,
			save,
			selector: recipe.grantSelector,
			target: {
				kind: "craftRecipe",
				craftRecipeId: targetItem.itemId,
				targetCell: targetItem,
			},
		});
		yield* checkItemCreateBlockedByEffectsFx({
			config,
			ignoredSourceIds: new Set([
				targetItemInstanceId,
			]),
			itemId: recipe.resultItemId,
			nowMs,
			save,
			targetCell: targetItem,
		});
		if (
			readBoardItemMaxCountCapacity({
				config,
				ignoredBoardItemInstanceIds: new Set([
					targetItemInstanceId,
				]),
				itemId: recipe.resultItemId,
				save,
			}) <= 0
		) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"board:max-count",
					`Board already has the maximum allowed count for "${recipe.resultItemId}".`,
				),
			);
		}
	},
);
