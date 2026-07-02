import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import type { Feedback } from "~/play/feedback/Feedback";
import type { TileEngine } from "~/tile-engine/TileEngine.types";
import { acceptDrop } from "~/play/drop/acceptDrop";
import type { DropActions } from "~/play/drop/DropActions";
import { rejectDrop } from "~/play/drop/rejectDrop";
import { resolveInventoryCellDropAction } from "~/play/drop/resolveInventoryCellDropAction";

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
		config: GameConfig;
		inventory: InventoryView;
		feedback: Feedback.Type;
		actions: DropActions;
	}
}

export const resolveInventoryCellDrop = ({
	actions,
	board,
	config,
	inventory,
	feedback,
	source,
	target,
}: resolveInventoryCellDrop.Props): TileEngine.DropOutcome => {
	const action = resolveInventoryCellDropAction({
		board,
		config,
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
		return acceptDrop(async () => {
			await actions.applyInventoryItemToBoardItem(action.input);
			if (action.feedback) {
				feedback.pulseBoardCellFeedback(action.feedback.cellKey, action.feedback.variant);
			}
		});
	}

	return acceptDrop(() => actions.placeInventoryItem(action.input));
};
