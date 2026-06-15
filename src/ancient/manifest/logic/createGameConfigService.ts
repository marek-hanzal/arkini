import { createGameDataIndex } from "~/manifest/createGameDataIndex";
import type { GameConfig } from "~/manifest/GameConfig";
import { itemMergePairKey } from "~/manifest/itemMergePairKey";
import type {
	AssetId,
	CraftRecipeId,
	ItemId,
	LootTableId,
	ResourceId,
	UpgradeId,
} from "~/manifest/manifestId";
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
		getStash(itemId) {
			return index.stashesByItemId.get(itemId as ItemId);
		},
		getActivation(itemId) {
			return index.activationsByItemId.get(itemId as ItemId);
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
		getMergeRulesForInput(itemId) {
			return index.mergeRulesByInputItemId.get(itemId as ItemId) ?? [];
		},
		getLootTable(tableId) {
			return index.lootTablesById.get(tableId as LootTableId);
		},
		getUpgrade(upgradeId) {
			return index.upgradesById.get(upgradeId as UpgradeId);
		},
		isProducer(itemId) {
			return index.producersByItemId.has(itemId as ItemId);
		},
		isStash(itemId) {
			return index.stashesByItemId.has(itemId as ItemId);
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
				producerCount: index.activationsByItemId.size,
				craftRecipeCount: index.craftRecipes.length,
				dropTableCount: 0,
			};
		},
	};
}
