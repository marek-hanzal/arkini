import { cellKey } from "~/v0/board/util/cell";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import type { DragSource, DropTarget } from "~/v0/play/DragTypes";
import type { Feedback } from "~/v0/play/Feedback";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";
import { acceptDrop } from "~/v0/play/drop/acceptDrop";
import type { DropActions } from "~/v0/play/drop/DropActions";
import { rejectDrop } from "~/v0/play/drop/rejectDrop";

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
		inventory: InventoryView;
		feedback: Feedback;
		actions: DropActions;
	}
}

export const resolveInventoryCellDrop = ({
	source,
	target,
	inventory,
	feedback,
	actions,
}: resolveInventoryCellDrop.Props): TileEngine.DropOutcome => {
	if (target.boardItemId) {
		return rejectDrop(() => feedback.flashBoardCell(cellKey(target.x, target.y)));
	}

	const sourceSlot = inventory.bySlotIndex[String(source.slotIndex)];
	if (!sourceSlot?.stack) {
		return rejectDrop(() => feedback.flashInventorySlot(source.slotIndex));
	}

	return acceptDrop(() =>
		actions.placeInventoryItem({
			slotIndex: source.slotIndex,
			x: target.x,
			y: target.y,
		}),
	);
};
