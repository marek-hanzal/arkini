import type { ItemId } from "~/config/GameIdSchema";

export interface ItemTargetLimit {
	itemId: ItemId;
	maxCount: number;
	ownedQuantity: number;
	remainingQuantity: number;
	requiredQuantity: number;
	sourceItemId?: ItemId;
}
