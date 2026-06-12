import { parseGameDataManifest } from "../schema";
import { pairKey } from "../merge";
import type { AssetId, BuildRecipeId, ItemId, MergeDefinitionId } from "../ids";
import type { GameDataManifest } from "../manifestTypes";
import { assert, assertUnique } from "./assert";
import { assertProducerDefinition } from "./producer";
import { assertStartingState } from "./startingState";

export function assertGameDataManifest(manifest: GameDataManifest) {
  parseGameDataManifest(manifest);

  const assetIds = new Set<AssetId>();
  const itemIds = new Set<ItemId>();
  const mergeIds = new Set<MergeDefinitionId>();
  const buildIds = new Set<BuildRecipeId>();
  const mergePairs = new Set<string>();

  for (const asset of manifest.assets) assertUnique(assetIds, asset.id, "asset");

  for (const item of manifest.items) {
    assertUnique(itemIds, item.id, "item");
    assert(assetIds.has(item.assetId), `${item.id} references missing asset ${item.assetId}`);
  }

  for (const item of manifest.items) {
    for (const rule of item.merge ?? []) {
      assertUnique(mergeIds, rule.id, "merge");
      assert(itemIds.has(rule.withItemId), `${rule.id} references missing merge input ${rule.withItemId}`);
      assert(itemIds.has(rule.resultItemId), `${rule.id} references missing merge output ${rule.resultItemId}`);
      assertUnique(mergePairs, pairKey(item.id, rule.withItemId), "merge pair");
    }

    if (item.build) {
      assertUnique(buildIds, item.build.id, "build recipe");
      assert(itemIds.has(item.build.resultItemId), `${item.build.id} references missing build result`);
      for (const cost of item.build.costs) assert(itemIds.has(cost.itemId), `${item.build.id} references missing cost ${cost.itemId}`);
    }

    assertProducerDefinition(item, itemIds);
  }

  assertStartingState(manifest, itemIds);
}
