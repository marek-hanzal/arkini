import { createGameDataIndex } from "~/manifest/data/createGameDataIndex";
import type { GameConfig } from "~/manifest/data/GameConfig";
import { itemMergePairKey } from "~/manifest/data/itemMergePairKey";
import type {
	AssetId,
	BuildRecipeId,
	CraftRecipeId,
	ItemId,
	ResourceId,
} from "~/manifest/data/manifestId";
import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";

export function createGameConfigService(config: GameConfig): GameConfigService {
	const index = createGameDataIndex(config);

	return {
		config,
		index,
		getAsset(assetId) {
			return index.assetsById.get(assetId as AssetId);
		},
		getResource(resourceId) {
			return index.resourcesById.get(resourceId as ResourceId);
		},
		getItem(itemId) {
			return index.itemsById.get(itemId as ItemId);
		},
		getProducer(itemId) {
			return index.producersByItemId.get(itemId as ItemId);
		},
		getBuildRecipe(recipeId) {
			return index.buildRecipesById.get(recipeId as BuildRecipeId);
		},
		getCraftRecipe(recipeId) {
			return index.craftRecipesById.get(recipeId as CraftRecipeId);
		},
		getCraftRecipeForTarget(itemId) {
			return index.craftRecipesByTargetItemId.get(itemId as ItemId);
		},
		getCraftRecipesForInput(itemId) {
			return index.craftRecipesByInputItemId.get(itemId as ItemId) ?? [];
		},
		isProducer(itemId) {
			return index.producersByItemId.has(itemId as ItemId);
		},
		isMergeableItem(itemId) {
			return index.mergeableItemIds.has(itemId as ItemId);
		},
		resolveMergeRule(sourceItemId, targetItemId) {
			return index.mergeRulesByPair.get(
				itemMergePairKey(sourceItemId as ItemId, targetItemId as ItemId),
			);
		},
		summary() {
			return {
				assetCount: config.assets.length,
				itemCount: config.items.length,
				mergeCount: index.merges.length,
				producerCount: index.producersByItemId.size,
				buildRecipeCount: index.buildRecipes.length,
				dropTableCount: 0,
			};
		},
	};
}
