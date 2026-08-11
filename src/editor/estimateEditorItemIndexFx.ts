import { Effect } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

import type {
	EditorItemEstimateIndexEntry,
	EditorItemEstimateIndexProgress,
} from "~/editor/EditorItemEstimateIndex";
import type { EditorItemSimulationScenarioResult } from "~/editor/simulator/EditorItemSimulation";
import { createEditorItemSimulatorFx } from "~/editor/simulator/createEditorItemSimulatorFx";

const readRuntime = (
	scenarios: ReadonlyArray<EditorItemSimulationScenarioResult>,
	scenario: "expected" | "guaranteed",
) => scenarios.find((candidate) => candidate.scenario === scenario)?.runtimeMs;

/** Computes the compact estimate projection used by the all-item editor index. */
export const estimateEditorItemIndexFx = Effect.fn("estimateEditorItemIndexFx")(
	(
		config: GameConfigSchema.Type,
		onProgress?: (progress: EditorItemEstimateIndexProgress) => void,
	) =>
		Effect.gen(function* () {
			const simulator = yield* createEditorItemSimulatorFx(config);
			const itemIds = Object.keys(config.items).sort((left, right) =>
				left.localeCompare(right),
			);
			return yield* Effect.forEach(itemIds, (itemId, index) =>
				simulator.simulateFx(itemId).pipe(
					Effect.tap(() =>
						onProgress === undefined
							? Effect.void
							: Effect.sync(() =>
									onProgress({
										completed: index + 1,
										itemId,
										total: itemIds.length,
									}),
								),
					),
					Effect.map(
						({ scenarios }): EditorItemEstimateIndexEntry => ({
							expectedRuntimeMs: readRuntime(scenarios, "expected"),
							guaranteedRuntimeMs: readRuntime(scenarios, "guaranteed"),
							itemId,
						}),
					),
				),
			);
		}),
);
