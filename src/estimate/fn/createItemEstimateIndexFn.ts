import { Order } from "effect";

import type { ItemEstimateIndexEntry } from "~/estimate/type/ItemEstimateIndex";
import type { ItemEstimate } from "~/estimate/type/ItemEstimate";

interface CreateItemEstimateIndexProps {
	readonly estimates: ReadonlyMap<string, ItemEstimate>;
	readonly itemIds: ReadonlyArray<string>;
}

/** Projects the cached full-catalog estimates into list timing and aggregate item demand. */
export const createItemEstimateIndexFn = ({
	estimates,
	itemIds,
}: CreateItemEstimateIndexProps): ReadonlyArray<ItemEstimateIndexEntry> => {
	const demandByItemId = new Map<string, number>();
	for (const estimate of estimates.values()) {
		if (!estimate.obtainable) continue;
		for (const step of estimate.routeSteps)
			demandByItemId.set(step.factId, (demandByItemId.get(step.factId) ?? 0) + step.quantity);
	}

	return itemIds
		.flatMap((itemId): ReadonlyArray<ItemEstimateIndexEntry> => {
			const estimate = estimates.get(itemId);
			return estimate === undefined
				? []
				: [
						{
							demand: demandByItemId.get(itemId) ?? 0,
							itemId,
							method: "static",
							runtimeMs: estimate.obtainable ? estimate.durationMs : undefined,
							status: estimate.status,
						},
					];
		})
		.sort((left, right) => Order.String(left.itemId, right.itemId));
};
