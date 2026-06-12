import type { BuildRecipeId, ItemId } from "./manifestId";

export interface ItemBuildRecipe {
	id: BuildRecipeId;
	resultItemId: ItemId;
	costs: readonly BuildRecipeCost[];
}

export interface BuildRecipeCost {
	itemId: ItemId;
	quantity: number;
}
