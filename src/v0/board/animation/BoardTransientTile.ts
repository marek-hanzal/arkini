import type { ItemId } from "~/v0/game/config/GameIdSchema";

export interface BoardTransientTile {
	id: string;
	groupId: string;
	itemId: ItemId;
	slotId: string;
}
