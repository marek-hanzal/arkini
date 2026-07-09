import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";

export function groupSlotsByItemId(slots: readonly InventorySlot[]) {
	return slots.reduce<Record<string, InventorySlot[]>>((byItemId, slot) => {
		if (!slot.stack) return byItemId;
		byItemId[slot.stack.itemId] ??= [];
		byItemId[slot.stack.itemId].push(slot);
		return byItemId;
	}, {});
}
