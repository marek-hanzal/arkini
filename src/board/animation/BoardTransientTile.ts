import type { ItemId } from "~/config/GameIdSchema";

export interface BoardTransientTile {
	id: string;
	groupId: string;
	itemId: ItemId;
	slotId: string;
}
