import { parseGameConfig } from "../parseGameConfig";
import { itemMergePairKey } from "../itemMergePairKey";
import type { AssetId, BuildRecipeId, ItemId, MergeDefinitionId } from "../manifestId";
import type { GameConfig } from "../GameConfig";
import { assert, assertUnique } from "./assert";
import { assertProducerDefinition } from "./producer";
import { assertStartingState } from "./startingState";

export function assertGameConfig(config: GameConfig) {
	parseGameConfig(config);

	const assetIds = new Set<AssetId>();
	const itemIds = new Set<ItemId>();
	const mergeIds = new Set<MergeDefinitionId>();
	const buildIds = new Set<BuildRecipeId>();
	const mergePairs = new Set<string>();

	for (const asset of config.assets) assertUnique(assetIds, asset.id, "asset");

	for (const item of config.items) {
		assertUnique(itemIds, item.id, "item");
		assert(assetIds.has(item.assetId), `${item.id} references missing asset ${item.assetId}`);
	}

	for (const item of config.items) {
		for (const rule of item.merge ?? []) {
			assertUnique(mergeIds, rule.id, "merge");
			assert(
				itemIds.has(rule.withItemId),
				`${rule.id} references missing merge input ${rule.withItemId}`,
			);
			assert(
				itemIds.has(rule.resultItemId),
				`${rule.id} references missing merge output ${rule.resultItemId}`,
			);
			assertUnique(mergePairs, itemMergePairKey(item.id, rule.withItemId), "merge pair");
		}

		if (item.build) {
			assertUnique(buildIds, item.build.id, "build recipe");
			assert(
				itemIds.has(item.build.resultItemId),
				`${item.build.id} references missing build result`,
			);
			for (const cost of item.build.costs)
				assert(
					itemIds.has(cost.itemId),
					`${item.build.id} references missing cost ${cost.itemId}`,
				);
		}

		assertProducerDefinition(item, itemIds);
	}

	assertStartingState(config, itemIds);
}
