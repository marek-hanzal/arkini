import { Effect } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

import type {
	EditorItemEstimateIndexEntry,
	EditorItemEstimateIndexProgress,
} from "~/editor/EditorItemEstimateIndex";
import type { EditorItemSimulation } from "~/editor/simulator/EditorItemSimulation";
import { createLegacyEditorItemSimulatorFx } from "~/editor/simulator/createLegacyEditorItemSimulatorFx";

interface EstimateEditorItemIndexOptions {
	readonly itemIds?: ReadonlyArray<string>;
	readonly onEstimate?: (estimate: EditorItemSimulation) => void;
	readonly onProgress?: (progress: EditorItemEstimateIndexProgress) => void;
}

/**
 * Computes the compact all-item index through the legacy recursive estimator. The detailed item
 * estimate path uses the engine-backed planner; this fast index remains isolated until its own
 * replacement can preserve interactive startup cost.
 */
export const estimateEditorItemIndexFx = Effect.fn("estimateEditorItemIndexFx")(
	(config: GameConfigSchema.Type, options: EstimateEditorItemIndexOptions = {}) =>
		Effect.gen(function* () {
			const simulator = yield* createLegacyEditorItemSimulatorFx(config);
			const itemIds = [
				...(options.itemIds ?? Object.keys(config.items)),
			].sort((left, right) => left.localeCompare(right));
			return yield* Effect.forEach(itemIds, (itemId, index) =>
				simulator.simulateFx(itemId).pipe(
					Effect.tap((estimate) =>
						options.onEstimate === undefined
							? Effect.void
							: Effect.sync(() => options.onEstimate?.(estimate)),
					),
					Effect.tap(() =>
						options.onProgress === undefined
							? Effect.void
							: Effect.sync(() =>
									options.onProgress?.({
										completed: index + 1,
										itemId,
										total: itemIds.length,
									}),
								),
					),
					Effect.map(
						(estimate): EditorItemEstimateIndexEntry => ({
							itemId,
							runtimeMs: estimate.runtimeMs,
						}),
					),
				),
			);
		}),
);
