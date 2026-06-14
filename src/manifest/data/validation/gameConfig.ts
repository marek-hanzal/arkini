import { parseGameConfig } from "../parseGameConfig";
import { itemMergePairKey } from "../itemMergePairKey";
import type {
	AssetId,
	CraftRecipeId,
	ItemId,
	LootTableId,
	MergeDefinitionId,
	ResourceId,
	UpgradeId,
} from "../manifestId";
import type { GameConfig } from "../GameConfig";
import { assert, assertUnique } from "./assert";
import { assertProducerDefinition } from "./producer";
import { assertStartingState } from "./startingState";

export function assertGameConfig(config: GameConfig) {
	parseGameConfig(config);

	const assetIds = new Set<AssetId>();
	const itemIds = new Set<ItemId>();
	const mergeIds = new Set<MergeDefinitionId>();
	const resourceIds = new Set<ResourceId>();
	const lootTableIds = new Set<LootTableId>();
	const upgradeIds = new Set<UpgradeId>();
	const craftIds = new Set<CraftRecipeId>();
	const mergePairs = new Set<string>();

	for (const asset of config.assets) assertUnique(assetIds, asset.id, "asset");
	for (const asset of config.assets) {
		if (asset.overlayAssetId) {
			assert(
				assetIds.has(asset.overlayAssetId),
				`${asset.id} references missing overlay asset ${asset.overlayAssetId}`,
			);
		}
	}
	for (const resource of config.resources) {
		assertUnique(resourceIds, resource.id, "resource");
	}
	for (const entry of config.startingState.resources) {
		assert(
			resourceIds.has(entry.resourceId),
			`starting resource references missing ${entry.resourceId}`,
		);
	}

	for (const table of config.lootTables) assertUnique(lootTableIds, table.id, "loot table");
	for (const upgrade of config.upgrades) assertUnique(upgradeIds, upgrade.id, "upgrade");

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

		if (item.craft) {
			assertUnique(craftIds, item.craft.id, "craft recipe");
			assert(
				itemIds.has(item.craft.resultItemId),
				`${item.craft.id} references missing craft result`,
			);
			for (const input of item.craft.inputs)
				assert(
					itemIds.has(input.itemId),
					`${item.craft.id} references missing craft input ${input.itemId}`,
				);
		}

		assertProducerDefinition(item, itemIds);
		if (item.producer?.outputTableId) {
			assert(
				lootTableIds.has(item.producer.outputTableId),
				`${item.id} producer references missing loot table ${item.producer.outputTableId}`,
			);
		}
	}

	for (const table of config.lootTables) {
		assert(table.output.length > 0, `${table.id} loot table must define output`);
	}

	for (const upgrade of config.upgrades) {
		for (const tier of upgrade.tiers) {
			for (const cost of tier.cost) {
				assert(
					itemIds.has(cost.itemId),
					`${upgrade.id} cost references missing item ${cost.itemId}`,
				);
			}
			for (const effect of tier.effects) {
				if (effect.type === "producer.cooldown.add") {
					assert(
						itemIds.has(effect.itemId),
						`${upgrade.id} cooldown effect references missing item ${effect.itemId}`,
					);
				}
				if (effect.type === "producer.outputTable.set") {
					assert(
						itemIds.has(effect.itemId),
						`${upgrade.id} loot effect references missing item ${effect.itemId}`,
					);
					assert(
						lootTableIds.has(effect.tableId),
						`${upgrade.id} loot effect references missing table ${effect.tableId}`,
					);
				}
			}
		}
	}

	assertStartingState(config, itemIds);
}
