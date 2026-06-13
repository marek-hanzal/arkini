export namespace manifestId {
	export type Asset = `asset:${string}`;
	export type Item = `item:${string}`;
	export type BuildRecipe = `build:${string}`;
	export type MergeDefinition = `merge:${string}`;
	export type Resource = `resource:${string}`;
}

export type AssetId = manifestId.Asset;
export type ItemId = manifestId.Item;
export type BuildRecipeId = manifestId.BuildRecipe;
export type MergeDefinitionId = manifestId.MergeDefinition;
export type ResourceId = manifestId.Resource;
