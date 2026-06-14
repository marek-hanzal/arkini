import type { AssetId, ItemId } from "./manifestId";
import type { ItemCraftRecipe } from "./craft";
import type { ItemMergeRule } from "./itemMergeRule";
import type { ProducerDefinition } from "./producer";

export interface ItemDefinition {
	id: ItemId;
	assetId: AssetId;
	code: string;
	name: string;
	tier: number;
	maxStackSize: number;
	description: string;
	label?: string;
	tags: readonly string[];
	sort: number;
	merge?: readonly ItemMergeRule[];
	producer?: ProducerDefinition;
	craft?: ItemCraftRecipe;
}
