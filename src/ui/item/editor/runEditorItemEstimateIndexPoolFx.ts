import { Effect } from "effect";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type {
	EditorItemEstimateIndexEntry,
	EditorItemEstimateIndexProgress,
} from "~/editor/EditorItemEstimateIndex";
import type { EditorItemSimulation } from "~/editor/simulator/EditorItemSimulation";
import type {
	EditorItemEstimateWorkerRequest,
	EditorItemEstimateWorkerResult,
} from "~/ui/item/editor/editorItemEstimateWorkerProtocol";
import { runEditorItemEstimateInWorkerFx } from "~/ui/item/editor/runEditorItemEstimateInWorkerFx";

interface RunEditorItemEstimateIndexPoolOptions {
	readonly cachedEstimates?: ReadonlyArray<EditorItemSimulation>;
	readonly onEstimate?: (estimate: EditorItemSimulation) => void;
	readonly onProgress?: (progress: EditorItemEstimateIndexProgress) => void;
	readonly poolSize?: number;
	readonly runInWorkerFx?: (
		request: EditorItemEstimateWorkerRequest,
		options?: {
			readonly onEstimate?: (estimate: EditorItemSimulation) => void;
			readonly onProgress?: (progress: EditorItemEstimateIndexProgress) => void;
		},
	) => Effect.Effect<EditorItemEstimateWorkerResult, unknown>;
}

const readRuntime = (estimate: EditorItemSimulation, scenario: "expected" | "guaranteed") =>
	estimate.scenarios.find((candidate) => candidate.scenario === scenario)?.runtimeMs;

const projectEntry = (estimate: EditorItemSimulation): EditorItemEstimateIndexEntry => ({
	expectedRuntimeMs: readRuntime(estimate, "expected"),
	guaranteedRuntimeMs: readRuntime(estimate, "guaranteed"),
	itemId: estimate.itemId,
});

/** Runs missing all-item estimates across at most three independently cancellable workers. */
export const runEditorItemEstimateIndexPoolFx = Effect.fn("runEditorItemEstimateIndexPoolFx")(
	(config: EditorProject["config"], options: RunEditorItemEstimateIndexPoolOptions = {}) =>
		Effect.gen(function* () {
			const itemIds = Object.keys(config.items).sort((left, right) =>
				left.localeCompare(right),
			);
			const total = itemIds.length;
			const cachedByItemId = new Map(
				(options.cachedEstimates ?? [])
					.filter(
						(estimate) =>
							estimate.quantity === 1 && config.items[estimate.itemId] !== undefined,
					)
					.map(
						(estimate) =>
							[
								estimate.itemId,
								estimate,
							] as const,
					),
			);
			const missingItemIds = itemIds.filter((itemId) => !cachedByItemId.has(itemId));
			if (missingItemIds.length === 0)
				return itemIds.map((itemId) => projectEntry(cachedByItemId.get(itemId)!));

			const workerCount = Math.min(
				Math.max(1, options.poolSize ?? 3),
				3,
				missingItemIds.length,
			);
			const chunks = Array.from(
				{
					length: workerCount,
				},
				(): string[] => [],
			);
			for (const [index, itemId] of missingItemIds.entries())
				chunks[index % workerCount]!.push(itemId);
			const completedByWorker = Array.from(
				{
					length: workerCount,
				},
				() => 0,
			);
			let publishedCompleted = cachedByItemId.size;
			const runInWorkerFx = options.runInWorkerFx ?? runEditorItemEstimateInWorkerFx;

			const results = yield* Effect.all(
				chunks.map((chunkItemIds, workerIndex) =>
					runInWorkerFx(
						{
							config,
							itemIds: chunkItemIds,
							type: "index",
						},
						{
							onEstimate: options.onEstimate,
							onProgress: (progress) => {
								completedByWorker[workerIndex] = Math.max(
									completedByWorker[workerIndex]!,
									progress.completed,
								);
								const completed = Math.max(
									publishedCompleted,
									cachedByItemId.size +
										completedByWorker.reduce((sum, value) => sum + value, 0),
								);
								publishedCompleted = completed;
								options.onProgress?.({
									completed,
									itemId: progress.itemId,
									total,
								});
							},
						},
					).pipe(
						Effect.flatMap((result) =>
							result.type === "index"
								? Effect.succeed(result.entries)
								: Effect.die(
										new Error("Estimate index worker returned an item result."),
									),
						),
					),
				),
				{
					concurrency: "unbounded",
				},
			);

			return [
				...cachedByItemId.values(),
			]
				.map(projectEntry)
				.concat(...results)
				.sort((left, right) => left.itemId.localeCompare(right.itemId));
		}),
);
