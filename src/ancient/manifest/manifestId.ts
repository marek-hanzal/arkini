import { GameAssetIdSchema } from "./GameAssetIdSchema";
import { GameCraftRecipeIdSchema } from "./GameCraftRecipeIdSchema";
import { GameItemIdSchema } from "./GameItemIdSchema";
import { GameLootTableIdSchema } from "./GameLootTableIdSchema";
import { GameMergeDefinitionIdSchema } from "./GameMergeDefinitionIdSchema";
import { GameResourceIdSchema } from "./GameResourceIdSchema";
import { GameUpgradeIdSchema } from "./GameUpgradeIdSchema";

export namespace manifestId {
	export type Asset = GameAssetIdSchema.Type;
	export type Item = GameItemIdSchema.Type;
	export type CraftRecipe = GameCraftRecipeIdSchema.Type;
	export type MergeDefinition = GameMergeDefinitionIdSchema.Type;
	export type Resource = GameResourceIdSchema.Type;
	export type LootTable = GameLootTableIdSchema.Type;
	export type Upgrade = GameUpgradeIdSchema.Type;
}

export type AssetId = manifestId.Asset;
export type ItemId = manifestId.Item;
export type CraftRecipeId = manifestId.CraftRecipe;
export type MergeDefinitionId = manifestId.MergeDefinition;
export type ResourceId = manifestId.Resource;
export type LootTableId = manifestId.LootTable;
export type UpgradeId = manifestId.Upgrade;
