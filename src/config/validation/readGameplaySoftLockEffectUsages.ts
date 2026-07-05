import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import { formatItemLabel } from "~/config/validation/GameConfigValidationFormatting";
import {
	readActivationOutputEffectEntries,
	readConfigCraftRecipes,
	readConfigLines,
} from "~/config/validation/GameConfigValidationReaders";

export type GameplaySoftLockEffectUsage = ReturnType<
	typeof readGameplaySoftLockEffectUsages
>[number];

export const isGameplayProgressionProducer = (config: GameConfig, producerId: string) => {
	const item = config.items[producerId];
	return producerId.startsWith("producer:") || item?.tags.includes("producer") === true;
};

export const readGameplaySoftLockEffectUsages = (config: GameConfig) => [
	...readConfigLines(config).map(({ line, linePath, ownerItemId }) => ({
		enforceSoftLock: isGameplayProgressionProducer(config, ownerItemId),
		label: `line "${line.id}" (${line.name})`,
		lineEffects: line.effects ?? [],
		path: [
			...linePath,
			"effects",
		] satisfies GameConfigIssuePath,
	})),
	...readConfigLines(config).flatMap(({ line, linePath, ownerItemId }) =>
		readActivationOutputEffectEntries({
			output: line.output ?? [],
			path: [
				...linePath,
				"output",
			],
		}).map((outputEntry) => ({
			enforceSoftLock: isGameplayProgressionProducer(config, ownerItemId),
			label: `line "${line.id}" (${line.name}) output ${formatItemLabel(config, outputEntry.itemId)}`,
			lineEffects: outputEntry.effects,
			path: [
				...outputEntry.path,
				"effects",
			] satisfies GameConfigIssuePath,
		})),
	),
	...readConfigCraftRecipes(config).map(([craftRecipeId, recipe]) => ({
		enforceSoftLock: isGameplayProgressionProducer(config, recipe.resultItemId),
		label: `craft recipe "${craftRecipeId}" -> ${formatItemLabel(config, recipe.resultItemId)}`,
		lineEffects: recipe.effects ?? [],
		path: [
			"items",
			craftRecipeId,
			"craft",
			"effects",
		] satisfies GameConfigIssuePath,
	})),
];
