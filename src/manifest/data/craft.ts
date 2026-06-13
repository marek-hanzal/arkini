import type { ItemId, CraftRecipeId } from "./manifestId";

export interface ItemCraftRecipe {
	id: CraftRecipeId;
	resultItemId: ItemId;
	inputs: readonly CraftRecipeInput[];
}

export interface CraftRecipeInput {
	itemId: ItemId;
	quantity: number;
}
