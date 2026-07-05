import { cellKey } from "~/board/cellKey";
import {
	createInventoryItemToBoardItemDropInput,
	createInventorySlotRejectDropAction,
} from "~/play/drop/createInventoryCellDropActions";
import type {
	InventoryCellDropAction,
	ResolveInventoryCellDropActionProps,
} from "~/play/drop/InventoryCellDropAction";
import { readCurrentSourceInventorySlotWithStack } from "~/play/drop/readCurrentSourceInventorySlotWithStack";
import { resolveInventoryItemToEmptyBoardCellDropAction } from "~/play/drop/resolveInventoryItemToEmptyBoardCellDropAction";
import { resolveInventoryItemToOccupiedBoardCellDropAction } from "~/play/drop/resolveInventoryItemToOccupiedBoardCellDropAction";

export type { InventoryCellDropAction } from "~/play/drop/InventoryCellDropAction";

export namespace resolveInventoryCellDropAction {
	export interface Props extends ResolveInventoryCellDropActionProps {}
}

export const resolveInventoryCellDropAction = ({
	board,
	config,
	inventory,
	source,
	target,
}: resolveInventoryCellDropAction.Props): InventoryCellDropAction => {
	const targetCellKey = cellKey(target.x, target.y);
	const sourceSlot = readCurrentSourceInventorySlotWithStack({
		inventory,
		source,
	});
	if (!sourceSlot) return createInventorySlotRejectDropAction(source.slotIndex);

	const targetItem = board.byCellKey[targetCellKey];
	if (!targetItem) {
		return resolveInventoryItemToEmptyBoardCellDropAction({
			config,
			source,
			sourceSlot,
			target,
			targetCellKey,
		});
	}

	return resolveInventoryItemToOccupiedBoardCellDropAction({
		config,
		input: createInventoryItemToBoardItemDropInput({
			source,
			sourceSlot,
			targetItem,
		}),
		sourceSlot,
		targetCellKey,
		targetItem,
	});
};
