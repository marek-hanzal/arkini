import type { GameConfig } from "./GameConfig";
import type { ItemId } from "./manifestId";
import type { ItemMergeRule } from "./itemMergeRule";
import { itemMergePairKey } from "./itemMergePairKey";

export type GameDataIndex = ReturnType<typeof createGameDataIndex>;

export function createGameDataIndex(config: GameConfig) {
	const assetsById = new Map(
		config.assets.map((asset) => [
			asset.id,
			asset,
		]),
	);
	const resourcesById = new Map(
		config.resources.map((resource) => [
			resource.id,
			resource,
		]),
	);
	const itemsById = new Map(
		config.items.map((item) => [
			item.id,
			item,
		]),
	);
	const mergeRulesByPair = new Map<
		string,
		ItemMergeRule & {
			sourceItemId: ItemId;
		}
	>();
	const merges = config.items.flatMap((item) =>
		(item.merge ?? []).map((rule) => ({
			...rule,
			sourceItemId: item.id,
		})),
	);

	for (const rule of merges) {
		mergeRulesByPair.set(itemMergePairKey(rule.sourceItemId, rule.withItemId), rule);
	}

	const craftRecipes = config.items.flatMap((item) =>
		item.craft
			? [
					{
						...item.craft,
						targetItemId: item.id,
					},
				]
			: [],
	);
	const craftRecipesByInputItemId = new Map<ItemId, typeof craftRecipes>();
	for (const recipe of craftRecipes) {
		for (const input of recipe.inputs) {
			const list = craftRecipesByInputItemId.get(input.itemId) ?? [];
			craftRecipesByInputItemId.set(input.itemId, [
				...list,
				recipe,
			]);
		}
	}

	return {
		assetsById,
		resourcesById,
		itemsById,
		merges,
		mergeRulesByPair,
		mergeableItemIds: new Set(
			merges.flatMap((rule) => [
				rule.sourceItemId,
				rule.withItemId,
			]),
		),
		craftRecipes,
		craftRecipesById: new Map(
			craftRecipes.map((recipe) => [
				recipe.id,
				recipe,
			]),
		),
		craftRecipesByTargetItemId: new Map(
			craftRecipes.map((recipe) => [
				recipe.targetItemId,
				recipe,
			]),
		),
		craftRecipesByInputItemId,
		producersByItemId: new Map(
			config.items.flatMap((item) =>
				item.producer
					? [
							[
								item.id,
								item.producer,
							] as const,
						]
					: [],
			),
		),
	};
}
