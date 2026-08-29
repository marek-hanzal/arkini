import { Effect } from "effect";

import type { EditorItemEstimateIndexEntry } from "~/editor/EditorItemEstimateIndex";
import type { EditorItemEstimate } from "~/editor/estimator/EditorItemEstimate";

/** Projects the cached full-catalog estimates into list timing and aggregate item demand. */
export const createEditorItemEstimateIndexFx = Effect.fn("createEditorItemEstimateIndexFx")(
	({
		estimates,
		itemIds,
	}: {
		readonly estimates: ReadonlyMap<string, EditorItemEstimate>;
		readonly itemIds: ReadonlyArray<string>;
	}) =>
		Effect.sync(() => {
			const demandByItemId = new Map<string, number>();
			for (const estimate of estimates.values()) {
				if (!estimate.obtainable) continue;
				for (const step of estimate.routeSteps)
					demandByItemId.set(
						step.factId,
						(demandByItemId.get(step.factId) ?? 0) +
							step.quantity * step.occurrenceCount,
					);
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
									runtimeMs: estimate.obtainable
										? estimate.durationMs
										: undefined,
									status: estimate.status,
								},
							];
				})
				.sort((left, right) => left.itemId.localeCompare(right.itemId));
		}),
);
