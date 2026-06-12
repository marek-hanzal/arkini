import type { BuildRecipeId, ItemId } from "./ids";

export interface ItemBuildRecipe {
  id: BuildRecipeId;
  resultItemId: ItemId;
  costs: readonly BuildRecipeCost[];
}

export interface BuildRecipeCost {
  itemId: ItemId;
  quantity: number;
}
