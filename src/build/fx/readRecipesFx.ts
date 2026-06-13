import { Effect } from "effect";
import { readViewFx as readInventoryViewFx } from "~/inventory/fx/readViewFx";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { canPayCosts } from "~/play/logic/canPayCosts";
import type { BuildRecipeView } from "~/play/logic/playTypes";

export const readRecipesFx = Effect.fn("readRecipesFx")(function* () {
	const gameConfig = yield* GameConfigServiceFx;
	const inventory = yield* readInventoryViewFx();

	return gameConfig.index.buildRecipes.map(
		(recipe): BuildRecipeView => ({
			id: recipe.id,
			blueprintItemId: recipe.blueprintItemId,
			resultItemId: recipe.resultItemId,
			costs: [
				...recipe.costs,
			],
			canBuild: canPayCosts(inventory.slots, [
				{
					itemId: recipe.blueprintItemId,
					quantity: 1,
				},
				...recipe.costs,
			]),
		}),
	);
});
