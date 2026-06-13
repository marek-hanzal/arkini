import type { PlayerInventorySlot } from "~/play/logic/playTypes";

export function groupSlotsByItemId(slots: readonly PlayerInventorySlot[]) {
	return slots.reduce<Record<string, PlayerInventorySlot[]>>((byItemId, slot) => {
		if (!slot.stack) return byItemId;
		byItemId[slot.stack.itemId] ??= [];
		byItemId[slot.stack.itemId].push(slot);
		return byItemId;
	}, {});
}
