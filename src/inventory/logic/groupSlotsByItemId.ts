import type { InventorySlot } from "~/play/logic/playTypes";

export function groupSlotsByItemId(slots: readonly InventorySlot[]) {
	return slots.reduce<Record<string, InventorySlot[]>>((byItemId, slot) => {
		if (!slot.stack) return byItemId;
		byItemId[slot.stack.itemId] ??= [];
		byItemId[slot.stack.itemId].push(slot);
		return byItemId;
	}, {});
}
