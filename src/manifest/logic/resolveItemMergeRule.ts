import type { ItemId } from "~/manifest/manifestId";
import { GameConfigServiceLive } from "~/manifest/logic/GameConfigServiceLive";

export function resolveItemMergeRule(sourceItemId: ItemId, targetItemId: ItemId) {
	return GameConfigServiceLive.resolveMergeRule(sourceItemId, targetItemId);
}
