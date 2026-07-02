import type { ItemId } from "~/config/GameIdSchema";

export interface BoardTransientTile {
	id: string;
	assetProgress?: number;
	groupId: string;
	itemId: ItemId;
	slotId: string;
}
