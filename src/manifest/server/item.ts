import type { AssetId, ItemId } from "./ids";
import type { ItemBuildRecipe } from "./build";
import type { ItemMergeRule } from "./merge";
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
  build?: ItemBuildRecipe;
}
