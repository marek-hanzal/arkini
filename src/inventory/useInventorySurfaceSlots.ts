import { useMemo } from "react";
import type { InventorySurface } from "~/inventory/InventorySurface.types";
import { useGameInventoryView } from "~/play/runtime/useGameRuntimeViews";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export const useInventorySurfaceSlots = ({
	inventory,
}: {
	inventory: ReturnType<typeof useGameInventoryView>;
}) => {
	const slotLayoutKey = inventory.slots.map((slot) => slot.slotIndex).join("|");
	return useMemo(
		() =>
			inventory.slots.map((slot) => ({
				id: String(slot.slotIndex),
				dropId: `inventory-slot:${slot.slotIndex}`,
				renderKey: slot.slotIndex,
				data: {
					slotIndex: slot.slotIndex,
				},
			})) satisfies TileEngine.Slot<InventorySurface.SlotData>[],
		[
			slotLayoutKey,
			inventory.slots,
		],
	);
};
