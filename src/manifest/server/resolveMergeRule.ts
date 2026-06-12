import type { ItemId } from "./ids";
import { gameDataIndex } from "./index";
import { pairKey } from "./merge";

export function resolveMergeRule(sourceItemId: ItemId, targetItemId: ItemId) {
  return gameDataIndex.mergeRulesByPair.get(pairKey(sourceItemId, targetItemId)) ?? null;
}
