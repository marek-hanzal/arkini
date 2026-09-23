import { Order } from "effect";

import type { ItemEstimateIndexEntry } from "~/estimate/type/ItemEstimateIndex";
import type { ItemEstimate } from "~/estimate/type/ItemEstimate";

interface CreateItemEstimateIndexProps {
	readonly estimates: ReadonlyMap<string, ItemEstimate>;
	readonly itemUids: ReadonlyArray<string>;
}

/** Projects the cached full-catalog estimates into list timing and aggregate item demand. */
export const createItemEstimateIndexFn = ({
	estimates,
	itemUids,
}: CreateItemEstimateIndexProps): ReadonlyArray<ItemEstimateIndexEntry> => {
	const demandByItemUid = new Map<string, number>();
	for (const estimate of estimates.values()) {
		if (!estimate.obtainable) continue;
		for (const step of estimate.routeSteps)
			demandByItemUid.set(
				step.factId,
				(demandByItemUid.get(step.factId) ?? 0) + step.quantity,
			);
	}

	return itemUids
		.flatMap((itemUid): ReadonlyArray<ItemEstimateIndexEntry> => {
			const estimate = estimates.get(itemUid);
			return estimate === undefined
				? []
				: [
						{
							demand: demandByItemUid.get(itemUid) ?? 0,
							itemUid,
							method: "static",
							runtimeMs: estimate.obtainable ? estimate.durationMs : undefined,
							status: estimate.status,
						},
					];
		})
		.sort((left, right) => Order.String(left.itemUid, right.itemUid));
};
