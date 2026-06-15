import type { DragSource, DropTarget } from "~/v0/play/DragTypes";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";
import { acceptDrop } from "~/v0/play/drop/acceptDrop";
import type { DropActions } from "~/v0/play/drop/DropActions";
import { ignoreDrop } from "~/v0/play/drop/ignoreDrop";

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
	}
}

export const resolveInventorySlotDrop = ({
	source,
	target,
	actions,
}: resolveInventorySlotDrop.Props): TileEngine.DropOutcome => {
	if (source.slotIndex === target.slotIndex) return ignoreDrop();

	return acceptDrop(() =>
		actions.swapInventorySlots({
			sourceSlotIndex: source.slotIndex,
			targetSlotIndex: target.slotIndex,
		}),
	);
};
