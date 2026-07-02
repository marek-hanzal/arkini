import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import type { TileEngine } from "~/tile-engine/TileEngine.types";
import { acceptDrop } from "~/play/drop/acceptDrop";
import type { DropActions } from "~/play/drop/DropActions";
import { ignoreDrop } from "~/play/drop/ignoreDrop";
import { resolveInventorySlotDropAction } from "~/play/drop/resolveInventorySlotDropAction";

export namespace resolveInventorySlotDrop {
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
				kind: "inventory-slot";
			}
		>;
		actions: DropActions;
		inventory: InventoryView;
	}
}

export const resolveInventorySlotDrop = ({
	source,
	target,
	actions,
	inventory,
}: resolveInventorySlotDrop.Props): TileEngine.DropOutcome => {
	const action = resolveInventorySlotDropAction({
		inventory,
		source,
		target,
	});

	if (action.type === "ignore") return ignoreDrop();
	if (action.type === "reject") return "reject";

	return acceptDrop(() => actions.swapInventorySlots(action.input), {
		animation: action.animation,
	});
};
