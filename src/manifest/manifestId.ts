export namespace manifestId {
	export type Asset = `asset:${string}`;
	export type Item = `item:${string}`;
	export type CraftRecipe = `craft:${string}`;
	export type MergeDefinition = `merge:${string}`;
	export type Resource = `resource:${string}`;
}

export type AssetId = manifestId.Asset;
export type ItemId = manifestId.Item;
export type CraftRecipeId = manifestId.CraftRecipe;
export type MergeDefinitionId = manifestId.MergeDefinition;
export type ResourceId = manifestId.Resource;
export type LootTableId = `loot:${string}`;
export type UpgradeId = `upgrade:${string}`;
