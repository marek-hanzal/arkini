import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readCraftBoardItemFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		targetItemInstanceId: string;
		recipeId?: string;
	}
}

export const readCraftBoardItemFx = Effect.fn("readCraftBoardItemFx")(function* ({
	config,
	save,
	targetItemInstanceId,
	recipeId,
}: readCraftBoardItemFx.Props) {
	const targetItem = save.board.items[targetItemInstanceId];
	if (!targetItem) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Craft target "${targetItemInstanceId}" is not on the board.`,
			),
		);
	}

	const targetRecipeId = targetItem.itemId;
	if (!config.craftRecipes[targetRecipeId]) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Item "${targetItem.itemId}" cannot craft.`,
			),
		);
	}

	if (recipeId && targetRecipeId !== recipeId) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Item "${targetItem.itemId}" cannot start craft recipe "${recipeId}".`,
			),
		);
	}

	const recipe = config.craftRecipes[targetRecipeId];
	if (!recipe) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing craft recipe "${targetRecipeId}".`),
		);
	}

	return {
		recipe,
		recipeId: targetRecipeId,
		targetItem,
	};
});
