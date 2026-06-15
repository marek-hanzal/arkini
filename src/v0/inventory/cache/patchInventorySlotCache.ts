import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { rebuildInventoryView } from "~/inventory/view/rebuildInventoryView";

export namespace patchInventorySlotCache {
	export interface Props {
		inventory: InventoryView;
		slotIndex: number;
		patch(slot: InventoryView["slots"][number]): InventoryView["slots"][number];
	}
}

export const patchInventorySlotCache = ({
	inventory,
	slotIndex,
	patch,
}: patchInventorySlotCache.Props) =>
	rebuildInventoryView(
		inventory.slots.map((slot) => (slot.slotIndex === slotIndex ? patch(slot) : slot)),
	);
