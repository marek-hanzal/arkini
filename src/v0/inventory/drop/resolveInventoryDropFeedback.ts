import type { InventorySurface } from "~/v0/inventory/InventorySurface.types";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import { resolveInventorySlotDropAction } from "~/v0/play/drop/resolveInventorySlotDropAction";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";

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
	const { source, target } = context;
	if (source.kind !== "inventory" || target?.kind !== "inventory-slot") return null;

	const action = resolveInventorySlotDropAction({
		source,
		target,
	});
	if (action.type === "ignore") return null;

	return {
		effect: "empty",
	};
};
