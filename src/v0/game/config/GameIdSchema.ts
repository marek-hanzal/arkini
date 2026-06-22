import { z } from "zod";

/**
 * Runtime IDs are authored in compiled JSON and cross-reference validated by
 * `GameConfigSchema` / `GameSaveConfigSchema`. Keep the local value schema generic;
 * stale TS enum mirrors were the old manifest's problem, not runtime truth.
 */
const GameIdSchema = z.string().min(1);

export const GameAssetIdSchema = GameIdSchema;
export const GameCraftRecipeIdSchema = GameIdSchema;
export const GameItemIdSchema = GameIdSchema;
export const GameLootTableIdSchema = GameIdSchema;
export const GameMergeDefinitionIdSchema = GameIdSchema;
export const GameResourceIdSchema = GameIdSchema;

export namespace GameAssetIdSchema {
	export type Type = z.infer<typeof GameAssetIdSchema>;
}

export namespace GameCraftRecipeIdSchema {
	export type Type = z.infer<typeof GameCraftRecipeIdSchema>;
}

export namespace GameItemIdSchema {
	export type Type = z.infer<typeof GameItemIdSchema>;
}

export namespace GameLootTableIdSchema {
	export type Type = z.infer<typeof GameLootTableIdSchema>;
}

export namespace GameMergeDefinitionIdSchema {
	export type Type = z.infer<typeof GameMergeDefinitionIdSchema>;
}

export namespace GameResourceIdSchema {
	export type Type = z.infer<typeof GameResourceIdSchema>;
}

export namespace gameId {
	export type Asset = GameAssetIdSchema.Type;
	export type CraftRecipe = GameCraftRecipeIdSchema.Type;
	export type Item = GameItemIdSchema.Type;
	export type LootTable = GameLootTableIdSchema.Type;
	export type MergeDefinition = GameMergeDefinitionIdSchema.Type;
	export type Resource = GameResourceIdSchema.Type;
}

export type AssetId = gameId.Asset;
export type CraftRecipeId = gameId.CraftRecipe;
export type ItemId = gameId.Item;
export type LootTableId = gameId.LootTable;
export type MergeDefinitionId = gameId.MergeDefinition;
export type ResourceId = gameId.Resource;
