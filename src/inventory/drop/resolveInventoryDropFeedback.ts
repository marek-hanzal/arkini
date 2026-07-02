import type { InventorySurface } from "~/inventory/InventorySurface.types";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import { resolveInventorySlotDropAction } from "~/play/drop/resolveInventorySlotDropAction";
import type { TileEngineNamespace as TileEngine } from "~/tile-engine";

export namespace resolveInventoryDropFeedback {
	export interface Props {
		context: TileEngine.DragOverContext<
			InventorySurface.TileData,
			InventorySlot,
			DragSource,
			DropTarget
		>;
		inventory: InventoryView;
	}
}

export const resolveInventoryDropFeedback = ({
	context,
	inventory,
}: resolveInventoryDropFeedback.Props): TileEngine.DropFeedback | null => {
	const { source, target } = context;
	if (source.kind !== "inventory" || target?.kind !== "inventory-slot") return null;
	const action = resolveInventorySlotDropAction({
		inventory,
		source,
		target,
	});
	if (action.type === "ignore") return null;
	if (action.type === "reject") {
		return {
			effect: "blocked",
		};
	}

	const targetStack = inventory.bySlotIndex[String(target.slotIndex)]?.stack;
	if (targetStack) {
		return {
			effect: "blocked",
		};
	}

	return {
		effect: "empty",
	};
};
