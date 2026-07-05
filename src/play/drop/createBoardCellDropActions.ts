import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import type {
	BoardCellDropAction,
	BoardItemToBoardItemActionInput,
} from "~/play/drop/BoardCellDropAction";

export const createBoardCellRejectDropAction = (targetCellKey: string): BoardCellDropAction => ({
	feedback: {
		kind: "board-cell",
		cellKey: targetCellKey,
	},
	type: "reject",
});

export const createBoardItemToBoardItemActionInput = ({
	source,
	sourceItem,
	targetItem,
}: {
	source: Extract<
		DragSource,
		{
			kind: "board";
		}
	>;
	sourceItem: BoardViewItem;
	targetItem: BoardViewItem;
}): BoardItemToBoardItemActionInput => ({
	expectedSourceItemId: sourceItem.itemId,
	expectedTargetItemId: targetItem.itemId,
	sourceBoardItemId: source.boardItemId,
	targetBoardItemId: targetItem.id,
});

export const createMoveBoardItemDropAction = ({
	source,
	sourceItem,
	target,
}: {
	source: Extract<
		DragSource,
		{
			kind: "board";
		}
	>;
	sourceItem: BoardViewItem;
	target: Extract<
		DropTarget,
		{
			kind: "cell";
		}
	>;
}): BoardCellDropAction => ({
	input: {
		boardItemId: source.boardItemId,
		expectedItemId: sourceItem.itemId,
		x: target.x,
		y: target.y,
	},
	type: "move-board-item",
});

export const createDeleteBoardItemDropAction = ({
	source,
	sourceItem,
	targetCellKey,
}: {
	source: Extract<
		DragSource,
		{
			kind: "board";
		}
	>;
	sourceItem: BoardViewItem;
	targetCellKey: string;
}): BoardCellDropAction => ({
	animation: "remove",
	feedback: {
		cellKey: targetCellKey,
		kind: "cell-feedback",
		variant: "danger",
	},
	input: {
		boardItemId: source.boardItemId,
		expectedItemId: sourceItem.itemId,
	},
	type: "delete-board-item",
});

export const createStoreBoardItemInInventoryDropAction = ({
	source,
	sourceItem,
	targetCellKey,
}: {
	source: Extract<
		DragSource,
		{
			kind: "board";
		}
	>;
	sourceItem: BoardViewItem;
	targetCellKey: string;
}): BoardCellDropAction => ({
	animation: "remove",
	feedback: {
		cellKey: targetCellKey,
		kind: "cell-feedback",
		variant: "primary",
	},
	input: {
		boardItemId: source.boardItemId,
		expectedItemId: sourceItem.itemId,
	},
	type: "store-board-item-in-inventory",
});
