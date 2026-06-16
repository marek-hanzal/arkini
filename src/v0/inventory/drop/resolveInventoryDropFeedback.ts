import type { InventorySurface } from "~/v0/inventory/InventorySurface.types";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace resolveInventoryDropFeedback {
	export interface Props {
		context: TileEngine.DragOverContext<
			InventorySurface.TileData,
			InventorySlot,
			DragSource,
			DropTarget
		>;
	}
}

export const resolveInventoryDropFeedback = ({
	context,
}: resolveInventoryDropFeedback.Props): TileEngine.DropFeedback | null => {
	const { source, target, targetTile } = context;
	if (source.kind !== "inventory" || target?.kind !== "inventory-slot") return null;

	if (source.slotIndex === target.slotIndex) return null;

	return {
		effect: targetTile ? "blocked" : "empty",
	};
};
