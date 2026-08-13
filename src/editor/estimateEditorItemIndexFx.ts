import { Effect } from "effect";

import type {
	EditorItemEstimateIndexEntry,
	EditorItemEstimateIndexProgress,
} from "~/editor/EditorItemEstimateIndex";
import { createPlannerAcquisitionGraphFx } from "~/editor/planner/createPlannerAcquisitionGraphFx";
import { readPlannerStructuralRuntimeIndex } from "~/editor/planner/readPlannerStructuralRuntimeIndex";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

interface EstimateEditorItemIndexOptions {
	readonly itemIds?: ReadonlyArray<string>;
	readonly onProgress?: (progress: EditorItemEstimateIndexProgress) => void;
}

/**
 * Computes a cheap planner-native projection for the all-item list.
 *
 * The projection uses the acquisition graph and authored output distributions, but deliberately
 * does not claim runtime feasibility. Opening one item runs the authoritative engine-backed search.
 */
export const estimateEditorItemIndexFx = Effect.fn("estimateEditorItemIndexFx")(
	(config: GameConfigSchema.Type, options: EstimateEditorItemIndexOptions = {}) =>
		Effect.gen(function* () {
			const graph = yield* createPlannerAcquisitionGraphFx(config);
			const runtimeByItemId = readPlannerStructuralRuntimeIndex({
				config,
				graph,
			});
			const itemIds = [
				...(options.itemIds ?? Object.keys(config.items)),
			].sort((left, right) => left.localeCompare(right));
			return yield* Effect.forEach(itemIds, (itemId, index) =>
				Effect.sync((): EditorItemEstimateIndexEntry => {
					const runtimeMs = runtimeByItemId.get(itemId);
					const status = graph.unreachableItemIds.has(itemId)
						? "no-finite-path"
						: runtimeMs === undefined
							? "inconclusive"
							: "estimated";
					options.onProgress?.({
						completed: index + 1,
						itemId,
						total: itemIds.length,
					});
					return {
						itemId,
						method: "structural-heuristic",
						runtimeMs,
						status,
					};
				}),
			);
		}),
);
