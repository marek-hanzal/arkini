import type { GameConfig } from "~/config/GameConfigTypes";
import { createGameplayItemSource } from "~/config/validation/createGameplaySoftLockSource";
import { formatItemLabel } from "~/config/validation/GameConfigValidationFormatting";
import { readCraftOutputItemIds } from "~/craft/readCraftRecipeOutput";
import { readConfigCraftRecipes } from "~/config/validation/GameConfigValidationReaders";
import {
	createItemRequirement,
	readLineEffectGameplayRequirements,
} from "~/config/validation/GameplaySoftLockRequirements";

export const createCraftGameplaySources = (config: GameConfig) =>
	readConfigCraftRecipes(config).flatMap(([craftRecipeId, recipe]) =>
		readCraftOutputItemIds(recipe).map((outputItemId) =>
			createGameplayItemSource({
				label: `craft recipe "${craftRecipeId}" -> ${formatItemLabel(config, outputItemId)}`,
				path: [
					"items",
					craftRecipeId,
					"craft",
				],
				requirements: [
					createItemRequirement({
						itemId: craftRecipeId,
						path: [
							"items",
							craftRecipeId,
							"craft",
						],
					}),
					...recipe.inputs.map((input, inputIndex) =>
						createItemRequirement({
							itemId: input.itemId,
							path: [
								"items",
								craftRecipeId,
								"craft",
								"inputs",
								inputIndex,
								"itemId",
							],
						}),
					),
					...readLineEffectGameplayRequirements({
						lineEffects: recipe.effects ?? [],
						path: [
							"items",
							craftRecipeId,
							"craft",
							"effects",
						],
					}),
				],
				sourceId: `craft:${craftRecipeId}:output:${outputItemId}`,
				targetId: outputItemId,
			}),
		),
	);
