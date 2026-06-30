import type { ItemId } from "~/v0/game/config/GameIdSchema";

export interface ItemTargetLimit {
	itemId: ItemId;
	maxCount: number;
	ownedQuantity: number;
	remainingQuantity: number;
	requiredQuantity: number;
	sourceItemId?: ItemId;
}
