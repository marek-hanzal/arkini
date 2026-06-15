import type { QueryClient } from "@tanstack/react-query";
import type { swapFx } from "~/inventory/fx/swapFx";
import { rebuildInventoryView } from "~/inventory/view/rebuildInventoryView";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { patchInventoryViewCache } from "~/v0/inventory/cache/patchInventoryViewCache";

export namespace applyInventorySwapCachePatch {
	export interface Props {
		queryClient: QueryClient;
		input: swapFx.Props;
	}
}

export const applyInventorySwapCachePatch = ({
	queryClient,
	input,
}: applyInventorySwapCachePatch.Props): CacheSnapshot.Type => ({
	inventory: patchInventoryViewCache({
		queryClient,
		patch: (inventory) => {
			const source = inventory.bySlotIndex[String(input.sourceSlotIndex)];
			const target = inventory.bySlotIndex[String(input.targetSlotIndex)];
			if (!source || !target) return inventory;

			return rebuildInventoryView(
				inventory.slots.map((slot) => {
					if (slot.slotIndex === source.slotIndex) {
						return {
							...slot,
							stack: target.stack,
						};
					}
					if (slot.slotIndex === target.slotIndex) {
						return {
							...slot,
							stack: source.stack,
						};
					}
					return slot;
				}),
			);
		},
	}),
});
