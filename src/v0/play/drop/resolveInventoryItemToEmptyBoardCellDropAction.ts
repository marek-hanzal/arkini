import type { GameConfig } from "~/config/GameConfigTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import { createBoardCellRejectDropAction } from "~/play/drop/createInventoryCellDropActions";
import type {
	InventoryCellDropAction,
	SourceInventorySlotWithStack,
} from "~/play/drop/InventoryCellDropAction";

export const resolveInventoryItemToEmptyBoardCellDropAction = ({
	config,
	source,
	sourceSlot,
	target,
	targetCellKey,
}: {
	config: GameConfig;
	source: Extract<
		DragSource,
		{
			kind: "inventory";
		}
	>;
	sourceSlot: SourceInventorySlotWithStack;
	target: Extract<
		DropTarget,
		{
			kind: "cell";
		}
	>;
	targetCellKey: string;
}): InventoryCellDropAction => {
	if (
		!isItemStorageAllowed({
			config,
			itemId: sourceSlot.stack.itemId,
			location: "board",
		})
	) {
		return createBoardCellRejectDropAction(targetCellKey);
	}

	return {
		input: {
			expectedItemId: sourceSlot.stack.itemId,
			expectedStackId: sourceSlot.stack.id,
			slotIndex: source.slotIndex,
			x: target.x,
			y: target.y,
		},
		type: "place-inventory-item",
	};
};
