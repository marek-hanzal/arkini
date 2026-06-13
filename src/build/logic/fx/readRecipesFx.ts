import { Effect } from "effect";
import { readViewFx as readInventoryViewFx } from "~/inventory/logic/fx/readViewFx";
import { gameDataIndex } from "~/manifest/data/gameDataIndex";
import { canPayCosts } from "~/play/logic/canPayCosts";
import type { BuildRecipeView } from "~/play/logic/playTypes";

export const readRecipesFx = Effect.fn("readRecipesFx")(function* () {
	const inventory = yield* readInventoryViewFx();

	return gameDataIndex.buildRecipes.map(
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
