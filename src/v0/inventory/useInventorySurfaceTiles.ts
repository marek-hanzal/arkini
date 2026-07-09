import { useMemo } from "react";
import type { InventorySurface } from "~/inventory/InventorySurface.types";
import { useGameInventoryView } from "~/play/runtime/useGameRuntimeViews";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export const useInventorySurfaceTiles = ({
	inventory,
}: {
	inventory: ReturnType<typeof useGameInventoryView>;
}) =>
	useMemo(
		() =>
			inventory.slots.flatMap((slot) => {
				const stack = slot.stack;
				if (!stack) return [];

				return [
					{
						id: stack.id,
						slotId: String(slot.slotIndex),
						renderKey: `inventory:${stack.id}:${slot.slotIndex}:${stack.itemId}:${stack.quantity}`,
						data: {
							slotIndex: slot.slotIndex,
							stackId: stack.id,
							itemId: stack.itemId,
							quantity: stack.quantity,
						},
					},
				] satisfies TileEngine.Tile<InventorySurface.TileData>[];
			}),
		[
			inventory.slots,
		],
	);
