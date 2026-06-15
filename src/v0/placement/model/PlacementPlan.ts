import type { ItemId } from "~/v0/manifest/manifestId";
import type { InventoryPlacementPlan } from "~/v0/placement/model/InventoryPlacementPlan";

export interface PlacementPlan {
	board: {
		itemId: ItemId;
		x: number;
		y: number;
	}[];
	inventory: InventoryPlacementPlan[];
}
