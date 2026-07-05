import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { DragSource } from "~/play/drag/DragSource";
import type {
	InventoryCellDropAction,
	InventoryItemToBoardItemDropInput,
	SourceInventorySlotWithStack,
} from "~/play/drop/InventoryCellDropAction";

export const createBoardCellRejectDropAction = (
	targetCellKey: string,
): InventoryCellDropAction => ({
	feedback: {
		kind: "board-cell",
		cellKey: targetCellKey,
	},
	type: "reject",
});

export const createInventorySlotRejectDropAction = (
	slotIndex: number,
): InventoryCellDropAction => ({
	feedback: {
		kind: "inventory-slot",
		slotIndex,
	},
	type: "reject",
});

export const createInventoryItemToBoardItemDropInput = ({
	source,
	sourceSlot,
	targetItem,
}: {
	source: Extract<
		DragSource,
		{
			kind: "inventory";
		}
	>;
	sourceSlot: SourceInventorySlotWithStack;
	targetItem: BoardViewItem;
}): InventoryItemToBoardItemDropInput => ({
	expectedSourceItemId: sourceSlot.stack.itemId,
	expectedSourceStackId: sourceSlot.stack.id,
	expectedTargetItemId: targetItem.itemId,
	sourceSlotIndex: source.slotIndex,
	targetBoardItemId: targetItem.id,
});
