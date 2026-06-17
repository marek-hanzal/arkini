import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { Feedback } from "~/v0/play/feedback/Feedback";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";
import { acceptDrop } from "~/v0/play/drop/acceptDrop";
import type { DropActions } from "~/v0/play/drop/DropActions";
import { rejectDrop } from "~/v0/play/drop/rejectDrop";
import { resolveInventoryCellDropAction } from "~/v0/play/drop/resolveInventoryCellDropAction";

export namespace resolveInventoryCellDrop {
	export interface Props {
		source: Extract<
			DragSource,
			{
				kind: "inventory";
			}
		>;
		target: Extract<
			DropTarget,
			{
				kind: "cell";
			}
		>;
		board: BoardView;
		inventory: InventoryView;
		feedback: Feedback.Type;
		actions: DropActions;
	}
}

export const resolveInventoryCellDrop = ({
	actions,
	board,
	inventory,
	feedback,
	source,
	target,
}: resolveInventoryCellDrop.Props): TileEngine.DropOutcome => {
	const action = resolveInventoryCellDropAction({
		board,
		inventory,
		source,
		target,
	});

	if (action.type === "reject") {
		return rejectDrop(() => {
			if (action.feedback.kind === "board-cell") {
				feedback.flashBoardCell(action.feedback.cellKey);
				return;
			}
			feedback.flashInventorySlot(action.feedback.slotIndex);
		});
	}

	if (action.type === "apply-inventory-item-to-board-item") {
		return acceptDrop(() => actions.applyInventoryItemToBoardItem(action.input));
	}

	return acceptDrop(() => actions.placeInventoryItem(action.input));
};
