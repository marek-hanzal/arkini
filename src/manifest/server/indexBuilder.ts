import type { GameDataManifest } from "./manifestTypes";
import type { ItemId } from "./ids";
import type { ItemMergeRule } from "./merge";
import { pairKey } from "./merge";

export function createGameDataIndex(manifest: GameDataManifest) {
  const assetsById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const itemsById = new Map(manifest.items.map((item) => [item.id, item]));
  const mergeRulesByPair = new Map<string, ItemMergeRule & { sourceItemId: ItemId }>();
  const merges = manifest.items.flatMap((item) =>
    (item.merge ?? []).map((rule) => ({ ...rule, sourceItemId: item.id })),
  );

  for (const rule of merges) {
    mergeRulesByPair.set(pairKey(rule.sourceItemId, rule.withItemId), rule);
  }

  const buildRecipes = manifest.items.flatMap((item) =>
    item.build ? [{ ...item.build, blueprintItemId: item.id }] : [],
  );

  return {
    assetsById,
    itemsById,
    merges,
    mergeRulesByPair,
    mergeableItemIds: new Set(merges.flatMap((rule) => [rule.sourceItemId, rule.withItemId])),
    buildRecipes,
    buildRecipesById: new Map(buildRecipes.map((recipe) => [recipe.id, recipe])),
    producersByItemId: new Map(manifest.items.flatMap((item) => item.producer ? [[item.id, item.producer] as const] : [])),
  };
}
