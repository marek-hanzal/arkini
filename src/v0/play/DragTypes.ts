import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import type { ItemId } from "~/manifest/manifestId";

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

export type DropTarget =
	| {
			kind: "cell";
			x: number;
			y: number;
			boardItemId?: string;
	  }
	| {
			kind: "inventory-slot";
			slotIndex: number;
	  }
	| {
			kind: "inventory";
	  };
