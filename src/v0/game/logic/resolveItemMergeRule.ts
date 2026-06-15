import type { ItemId } from "~/v0/manifest/manifestId";
import { GameConfigServiceLive } from "~/v0/game/logic/GameConfigServiceLive";

export function resolveItemMergeRule(sourceItemId: ItemId, targetItemId: ItemId) {
	return GameConfigServiceLive.resolveMergeRule(sourceItemId, targetItemId);
}
