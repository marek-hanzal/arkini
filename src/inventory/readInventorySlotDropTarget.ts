import type { InventoryTileEngineSlot } from "~/inventory/InventoryTileEngineModelTypes";

export const readInventorySlotDropTarget = ({ slot }: { slot: InventoryTileEngineSlot }) => ({
	data: {
		kind: "inventory-slot" as const,
		slotIndex: slot.data.slotIndex,
	},
});
