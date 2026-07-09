import type { ItemId } from "~/config/IdSchema";

export interface ItemTargetLimit {
	itemId: ItemId;
	maxCount: number;
	ownedQuantity: number;
	remainingQuantity: number;
	requiredQuantity: number;
	sourceItemId?: ItemId;
}
