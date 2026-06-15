import { groupSlotsByItemId } from "~/v0/inventory/logic/groupSlotsByItemId";
import type { InventorySlot } from "./InventorySlotSchema";
import type { InventoryView } from "./InventoryViewSchema";

export const rebuildInventoryView = (slots: readonly InventorySlot[]): InventoryView => {
	const normalizedSlots = slots.map((slot) => ({
		...slot,
	}));

	return {
		slots: normalizedSlots,
		bySlotIndex: Object.fromEntries(
			normalizedSlots.map((slot) => [
				slot.slotIndex,
				slot,
			]),
		),
		stacksByItemId: groupSlotsByItemId(normalizedSlots),
		firstEmptySlotIndex: normalizedSlots.find((slot) => !slot.stack)?.slotIndex,
	};
};
