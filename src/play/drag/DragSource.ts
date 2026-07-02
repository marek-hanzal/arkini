import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import type { ItemId } from "~/config/GameIdSchema";

export type DragSource =
	| {
			kind: "board";
			boardItemId: string;
			itemId: ItemId;
			boardItem: BoardViewItem;
	  }
	| {
			kind: "inventory";
			slotIndex: number;
			itemId: ItemId;
			slot: InventorySlot;
	  };
