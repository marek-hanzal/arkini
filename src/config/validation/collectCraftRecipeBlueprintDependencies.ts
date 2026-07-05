import type { GameConfig } from "~/config/GameConfigTypes";
import type { AddBlueprintDependencyItem } from "~/config/validation/BlueprintDependencyTypes";
import { readConfigCraftRecipes } from "~/config/validation/GameConfigValidationReaders";
import { collectLineEffectDependencyItems } from "~/config/validation/collectLineEffectDependencyItems";

export const collectCraftRecipeBlueprintDependencies = ({
	addDependencyItem,
	blueprintItemIds,
	config,
}: {
	addDependencyItem: AddBlueprintDependencyItem;
	blueprintItemIds: ReadonlySet<string>;
	config: GameConfig;
}) => {
	for (const [craftRecipeId, recipe] of readConfigCraftRecipes(config)) {
		if (!blueprintItemIds.has(craftRecipeId)) continue;

		for (const [inputIndex, input] of recipe.inputs.entries()) {
			addDependencyItem({
				fromBlueprintItemId: craftRecipeId,
				itemId: input.itemId,
				path: [
					"items",
					craftRecipeId,
					"craft",
					"inputs",
					inputIndex,
					"itemId",
				],
			});
		}

		collectLineEffectDependencyItems({
			addDependencyItem,
			config,
			fromBlueprintItemId: craftRecipeId,
			lineEffects: recipe.effects ?? [],
			path: [
				"items",
				craftRecipeId,
				"craft",
				"effects",
			],
		});
	}
};
