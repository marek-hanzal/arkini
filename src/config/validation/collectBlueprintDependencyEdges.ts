import { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameDropEffectSchema } from "~/config/schema/GameDropEffectSchema";
import { GameLineEffectSchema } from "~/config/schema/GameLineEffectSchema";
import { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import type {
	AddBlueprintDependencyItem,
	BlueprintDependencyCollector,
	BlueprintDependencyItem,
} from "~/config/validation/BlueprintDependencyTypes";
import type { GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import {
	readActivationOutputEffectEntries,
	readActivationOutputItemIds,
	readConfigCraftRecipes,
	readConfigLines,
} from "~/config/validation/GameConfigValidationReaders";
import { readDomainSelectorIds } from "~/config/validation/GameConfigSelectorValidation";
import {
	readBlueprintDependenciesForItem,
	readBlueprintItemIds,
	readBlueprintItemIdsByCraftResultItemId,
	readPassiveGrantSourceItemIdsByGrantId,
} from "~/config/validation/readBlueprintDependencyItems";

const addBlueprintDependencyItem = (
	collector: BlueprintDependencyCollector,
	item: BlueprintDependencyItem,
) => {
	for (const toBlueprintItemId of readBlueprintDependenciesForItem({
		blueprintItemIds: collector.blueprintItemIds,
		blueprintItemIdsByCraftResultItemId: collector.blueprintItemIdsByCraftResultItemId,
		itemId: item.itemId,
	})) {
		const edges = collector.edgesByBlueprintItemId.get(item.fromBlueprintItemId) ?? [];
		edges.push({
			path: item.path,
			toBlueprintItemId,
			viaItemId: item.itemId,
		});
		collector.edgesByBlueprintItemId.set(item.fromBlueprintItemId, edges);
	}
};

const createBlueprintDependencyCollector = (config: GameConfig): BlueprintDependencyCollector => {
	const blueprintItemIds = readBlueprintItemIds(config);
	return {
		blueprintItemIds,
		blueprintItemIdsByCraftResultItemId: readBlueprintItemIdsByCraftResultItemId(
			config,
			blueprintItemIds,
		),
		edgesByBlueprintItemId: new Map(),
	};
};

export const collectBlueprintDependencyEdges = (config: GameConfig) => {
	const collector = createBlueprintDependencyCollector(config);
	const addDependencyItem = (item: BlueprintDependencyItem) =>
		addBlueprintDependencyItem(collector, item);

	collectCraftRecipeBlueprintDependencies({
		addDependencyItem,
		blueprintItemIds: collector.blueprintItemIds,
		config,
	});
	collectLineBlueprintDependencies({
		addDependencyItem,
		blueprintItemIds: collector.blueprintItemIds,
		config,
	});
	collectMergeBlueprintDependencies({
		addDependencyItem,
		blueprintItemIds: collector.blueprintItemIds,
		config,
	});

	return collector;
};

const collectCraftRecipeBlueprintDependencies = ({
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

const collectLineBlueprintDependencies = ({
	addDependencyItem,
	blueprintItemIds,
	config,
}: {
	addDependencyItem: AddBlueprintDependencyItem;
	blueprintItemIds: ReadonlySet<string>;
	config: GameConfig;
}) => {
	for (const { line, lineIndex, linePath, ownerItemId } of readConfigLines(config)) {
		const outputEntries = readActivationOutputEffectEntries({
			output: line.output ?? [],
			path: [
				...linePath,
				"output",
			],
		});

		for (const outputEntry of outputEntries) {
			if (!blueprintItemIds.has(outputEntry.itemId)) continue;
			const fromBlueprintItemId = outputEntry.itemId;
			addDependencyItem({
				fromBlueprintItemId,
				itemId: ownerItemId,
				path:
					lineIndex === undefined
						? [
								...linePath,
								"id",
							]
						: [
								"items",
								ownerItemId,
								"producer",
								"lines",
								lineIndex,
								"id",
							],
			});

			for (const [inputIndex, input] of (line.inputs ?? []).entries()) {
				addDependencyItem({
					fromBlueprintItemId,
					itemId: input.itemId,
					path: [
						...linePath,
						"inputs",
						inputIndex,
						"itemId",
					],
				});
			}

			collectLineEffectDependencyItems({
				addDependencyItem,
				config,
				fromBlueprintItemId,
				lineEffects: outputEntry.effects,
				path: [
					...outputEntry.path,
					"effects",
				],
			});
		}
	}
};

const collectMergeBlueprintDependencies = ({
	addDependencyItem,
	blueprintItemIds,
	config,
}: {
	addDependencyItem: AddBlueprintDependencyItem;
	blueprintItemIds: ReadonlySet<string>;
	config: GameConfig;
}) => {
	for (const [sourceItemId, item] of Object.entries(config.items)) {
		for (const [mergeIndex, merge] of (item.merges ?? []).entries()) {
			const outputBlueprintIds = [
				...("resultItemId" in merge
					? [
							merge.resultItemId,
						]
					: []),
				...readActivationOutputItemIds(merge.output ?? []),
			].filter((itemId) => blueprintItemIds.has(itemId));
			for (const blueprintItemId of outputBlueprintIds) {
				addDependencyItem({
					fromBlueprintItemId: blueprintItemId,
					itemId: sourceItemId,
					path: [
						"items",
						sourceItemId,
						"merges",
						mergeIndex,
					],
				});
				addDependencyItem({
					fromBlueprintItemId: blueprintItemId,
					itemId: merge.withItemId,
					path: [
						"items",
						sourceItemId,
						"merges",
						mergeIndex,
						"withItemId",
					],
				});
			}
		}
	}
};

type GameConfigRuntimeEffect =
	| z.infer<typeof GameLineEffectSchema>
	| z.infer<typeof GameDropEffectSchema>;

const collectLineEffectDependencyItems = ({
	addDependencyItem,
	config,
	fromBlueprintItemId,
	lineEffects,
	path,
}: {
	addDependencyItem: AddBlueprintDependencyItem;
	config: GameConfig;
	fromBlueprintItemId: string;
	lineEffects: readonly GameConfigRuntimeEffect[];
	path: GameConfigIssuePath;
}) => {
	for (const [lineEffectIndex, lineEffect] of lineEffects.entries()) {
		if (lineEffect.kind === "grant.require") {
			collectGrantDependencyItems({
				addDependencyItem,
				config,
				fromBlueprintItemId,
				selector: lineEffect.selector,
				path: [
					...path,
					lineEffectIndex,
					"selector",
				],
			});
		}

		if (lineEffect.kind === "nearby.require") {
			for (const itemId of readDomainSelectorIds(
				lineEffect.items as z.infer<typeof ResolvedDomainSelectorSchema>,
			)) {
				addDependencyItem({
					fromBlueprintItemId,
					itemId,
					path: [
						...path,
						lineEffectIndex,
						"items",
					],
				});
			}
		}
	}
};

const collectGrantDependencyItems = ({
	addDependencyItem,
	config,
	fromBlueprintItemId,
	selector,
	path,
}: {
	addDependencyItem: AddBlueprintDependencyItem;
	config: GameConfig;
	fromBlueprintItemId: string;
	selector: z.infer<typeof ResolvedDomainSelectorSchema> | undefined;
	path: GameConfigIssuePath;
}) => {
	if (!selector) return;

	const grantSourceItemIdsByGrantId = readPassiveGrantSourceItemIdsByGrantId(config);
	for (const grantId of readDomainSelectorIds(selector)) {
		for (const itemId of grantSourceItemIdsByGrantId.get(grantId) ?? []) {
			addDependencyItem({
				fromBlueprintItemId,
				itemId,
				path,
			});
		}
	}
};
