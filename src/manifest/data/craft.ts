import type { CraftRecipeId, ItemId } from "./manifestId";

export interface ItemCraftRecipe {
	id: CraftRecipeId;
	resultItemId: ItemId;
	inputs: readonly CraftRecipeInput[];
	/** Real-world milliseconds between all inputs being delivered and the result becoming available. */
	durationMs: number;
}

export interface CraftRecipeInput {
	itemId: ItemId;
	quantity: number;
}
