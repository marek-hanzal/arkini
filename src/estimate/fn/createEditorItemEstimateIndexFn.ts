import { Order } from "effect";

import type { EditorItemEstimateIndexEntry } from "~/estimate/type/EditorItemEstimateIndex";
import type { EditorItemEstimate } from "~/estimate/type/EditorItemEstimate";

interface CreateEditorItemEstimateIndexProps {
	readonly estimates: ReadonlyMap<string, EditorItemEstimate>;
	readonly itemIds: ReadonlyArray<string>;
}

/** Projects the cached full-catalog estimates into list timing and aggregate item demand. */
export const createEditorItemEstimateIndexFn = ({
	estimates,
	itemIds,
}: CreateEditorItemEstimateIndexProps): ReadonlyArray<EditorItemEstimateIndexEntry> => {
	const demandByItemId = new Map<string, number>();
	for (const estimate of estimates.values()) {
		if (!estimate.obtainable) continue;
		for (const step of estimate.routeSteps)
			demandByItemId.set(step.factId, (demandByItemId.get(step.factId) ?? 0) + step.quantity);
	}

	return itemIds
		.flatMap((itemId): ReadonlyArray<EditorItemEstimateIndexEntry> => {
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
