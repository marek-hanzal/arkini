import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { readExpectedInventorySlotStack } from "~/inventory/view/readExpectedInventorySlotStack";
import type { DragSource } from "~/play/drag/DragSource";
import type { SourceInventorySlotWithStack } from "~/play/drop/InventoryCellDropAction";

export const readCurrentSourceInventorySlotWithStack = ({
	inventory,
	source,
}: {
	inventory: InventoryView;
	source: Extract<
		DragSource,
		{
			kind: "inventory";
		}
	>;
}): SourceInventorySlotWithStack | undefined => {
	const stack = readExpectedInventorySlotStack({
		expectedItemId: source.itemId,
		expectedStackId: source.slot.stack?.id ?? "",
		inventory,
		slotIndex: source.slotIndex,
	});
	if (!stack) return undefined;

	return {
		slotIndex: source.slotIndex,
		stack,
	};
};
