import { gameDataIndex } from "./gameDataIndex";
import { itemMergePairKey } from "./itemMergePairKey";
import type { ItemId } from "./manifestId";

export function resolveItemMergeRule(sourceItemId: ItemId, targetItemId: ItemId) {
	return gameDataIndex.mergeRulesByPair.get(itemMergePairKey(sourceItemId, targetItemId)) ?? null;
}
