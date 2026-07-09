import type { ItemId } from "~/config/IdSchema";

export interface BoardTransientTile {
	id: string;
	assetProgress?: number;
	groupId: string;
	hiddenBoardItemId?: string;
	itemId: ItemId;
	quantity?: number;
	slotId: string;
}
