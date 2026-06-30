import type { ItemTargetLimit } from "~/v0/game/limit/ItemTargetLimit";

export const mergeItemTargetLimits = (limits: readonly ItemTargetLimit[]) => {
	const merged = new Map<string, ItemTargetLimit>();

	for (const limit of limits) {
		const existing = merged.get(limit.itemId);
		if (!existing) {
			merged.set(limit.itemId, limit);
			continue;
		}

		merged.set(limit.itemId, {
			...existing,
			requiredQuantity: existing.requiredQuantity + limit.requiredQuantity,
		});
	}

	return Array.from(merged.values());
};
