import type { UpgradeCostDefinition } from "~/v0/manifest/upgrade";

export const groupQuantity = (cost: readonly UpgradeCostDefinition[]) => {
	const grouped = new Map<string, number>();
	for (const entry of cost) {
		grouped.set(entry.itemId, (grouped.get(entry.itemId) ?? 0) + entry.quantity);
	}
	return grouped;
};
