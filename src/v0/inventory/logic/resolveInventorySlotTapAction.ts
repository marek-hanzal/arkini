import type { BoardCellSchema } from "~/v0/board/schema/BoardCellSchema";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";

export namespace resolveInventorySlotTapAction {
	export interface Props {
		firstEmptyCell: BoardCellSchema.Type | undefined;
		slot: InventorySlot;
	}

	export type Result =
		| {
				type: "place-on-board";
				slotIndex: number;
				x: number;
				y: number;
		  }
		| {
				type: "flash-inventory-slot";
				slotIndex: number;
		  };
}

export const resolveInventorySlotTapAction = ({
	firstEmptyCell,
	slot,
}: resolveInventorySlotTapAction.Props): resolveInventorySlotTapAction.Result => {
	if (!slot.stack || !firstEmptyCell) {
		return {
			type: "flash-inventory-slot",
			slotIndex: slot.slotIndex,
		};
	}

	return {
		type: "place-on-board",
		slotIndex: slot.slotIndex,
		x: firstEmptyCell.x,
		y: firstEmptyCell.y,
	};
};
