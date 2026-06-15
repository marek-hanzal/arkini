import type { QueryClient } from "@tanstack/react-query";
import type { swapFx } from "~/inventory/fx/swapFx";
import { rebuildInventoryView } from "~/inventory/view/rebuildInventoryView";
import type { OptimisticSnapshot } from "~/v0/mutation/OptimisticSnapshot";
import { patchInventoryView } from "~/v0/mutation/optimistic/patchInventoryView";

export namespace applyInventorySwapOptimisticPatch {
	export interface Props {
		queryClient: QueryClient;
		input: swapFx.Props;
	}
}

export const applyInventorySwapOptimisticPatch = ({
	queryClient,
	input,
}: applyInventorySwapOptimisticPatch.Props): OptimisticSnapshot => ({
	inventory: patchInventoryView({
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
