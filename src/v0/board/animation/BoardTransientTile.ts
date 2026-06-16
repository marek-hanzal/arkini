import type { ItemId } from "~/v0/manifest/manifestId";

export interface BoardTransientTile {
	id: string;
	groupId: string;
	itemId: ItemId;
	slotId: string;
}
