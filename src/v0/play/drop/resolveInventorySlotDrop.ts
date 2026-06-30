import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";
import { acceptDrop } from "~/v0/play/drop/acceptDrop";
import type { DropActions } from "~/v0/play/drop/DropActions";
import { ignoreDrop } from "~/v0/play/drop/ignoreDrop";
import { resolveInventorySlotDropAction } from "~/v0/play/drop/resolveInventorySlotDropAction";

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
