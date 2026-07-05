import type { GameConfig } from "~/config/GameConfigTypes";
import { readConfigCraftRecipes } from "~/config/validation/GameConfigValidationReaders";

export const readBlueprintItemIds = (config: GameConfig) =>
	new Set(
		Object.entries(config.items)
			.filter(([itemId, item]) => {
				const primaryAsset = config.assets[item.assetIds[0]];

				return (
					itemId.startsWith("item:blueprint-") ||
					item.tags.includes("blueprint") ||
					primaryAsset?.render === "blueprint"
				);
			})
			.map(([itemId]) => itemId),
	);

export const readBlueprintItemIdsByCraftResultItemId = (
	config: GameConfig,
	blueprintItemIds: ReadonlySet<string>,
) => {
	const result = new Map<string, string[]>();

	for (const [craftRecipeId, recipe] of readConfigCraftRecipes(config)) {
		if (!blueprintItemIds.has(craftRecipeId)) continue;
		result.set(recipe.resultItemId, [
			...(result.get(recipe.resultItemId) ?? []),
			craftRecipeId,
		]);
	}

	return result;
};

export const readBlueprintDependenciesForItem = ({
	blueprintItemIds,
	blueprintItemIdsByCraftResultItemId,
	itemId,
}: {
	blueprintItemIds: ReadonlySet<string>;
	blueprintItemIdsByCraftResultItemId: ReadonlyMap<string, readonly string[]>;
	itemId: string;
}) => {
	const dependencies = new Set<string>();
	if (blueprintItemIds.has(itemId)) dependencies.add(itemId);
	for (const blueprintItemId of blueprintItemIdsByCraftResultItemId.get(itemId) ?? []) {
		dependencies.add(blueprintItemId);
	}
	return dependencies;
};

export const readPassiveGrantSourceItemIdsByGrantId = (config: GameConfig) => {
	const result = new Map<string, string[]>();
	for (const [itemId, item] of Object.entries(config.items)) {
		for (const effect of item.effects ?? []) {
			for (const grantId of effect.grants.map((grant) => grant.id)) {
				result.set(grantId, [
					...(result.get(grantId) ?? []),
					itemId,
				]);
			}
		}
	}
	return result;
};

export const readBlueprintItemDisplayName = (config: GameConfig, itemId: string) =>
	config.items[itemId]?.name ?? itemId;
