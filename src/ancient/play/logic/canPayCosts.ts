import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";

export function canPayCosts(
	inventory: readonly InventorySlot[],
	costs: readonly canPayCosts.Cost[],
) {
	const owned = new Map<string, number>();
	for (const slot of inventory) {
		if (!slot.stack) continue;
		owned.set(slot.stack.itemId, (owned.get(slot.stack.itemId) ?? 0) + slot.stack.quantity);
	}

	return costs.every((cost) => (owned.get(cost.itemId) ?? 0) >= cost.quantity);
}

export namespace canPayCosts {
	export interface Cost {
		itemId: string;
		quantity: number;
	}
}
