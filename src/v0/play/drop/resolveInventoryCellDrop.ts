import { cellKey } from "~/v0/board/cellKey";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { Feedback } from "~/v0/play/feedback/Feedback";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";
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
		feedback: Feedback.Type;
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
