import { gameDataIndex } from "~/manifest/data/gameDataIndex";
import { canPayCosts } from "./canPayCosts";
import { readInventoryView } from "./readInventoryView";
import type { BuildRecipeView } from "./playTypes";

export async function readBuildRecipeViews(): Promise<BuildRecipeView[]> {
	const inventory = await readInventoryView();

	return gameDataIndex.buildRecipes.map((recipe) => ({
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
	}));
}
