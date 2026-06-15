import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { rebuildInventoryView } from "~/inventory/view/rebuildInventoryView";

export namespace patchInventorySlot {
	export interface Props {
		inventory: InventoryView;
		slotIndex: number;
		patch(slot: InventoryView["slots"][number]): InventoryView["slots"][number];
	}
}

export const patchInventorySlot = ({ inventory, slotIndex, patch }: patchInventorySlot.Props) =>
	rebuildInventoryView(
		inventory.slots.map((slot) => (slot.slotIndex === slotIndex ? patch(slot) : slot)),
	);
