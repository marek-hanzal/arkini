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
	readonly onProgress?: (progress: EditorItemEstimateIndexProgress) => void;
	readonly runInWorkerFx?: (
		request: EditorItemEstimateWorkerRequest,
		options?: {
			readonly onProgress?: (progress: EditorItemEstimateIndexProgress) => void;
		},
	) => Effect.Effect<EditorItemEstimateWorkerResult, unknown>;
}

const projectEntry = (estimate: EditorItemSimulation): EditorItemEstimateIndexEntry => ({
	itemId: estimate.itemId,
	method: "engine-backed",
	runtimeMs: estimate.runtimeMs,
	status: estimate.status,
});

/** Runs the cheap planner-native all-item projection in one cancellable worker. */
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

			const runInWorkerFx = options.runInWorkerFx ?? runEditorItemEstimateInWorkerFx;
			const result = yield* runInWorkerFx(
				{
					config,
					itemIds: missingItemIds,
					type: "index",
				},
				{
					onProgress: (progress) =>
						options.onProgress?.({
							completed: cachedByItemId.size + progress.completed,
							itemId: progress.itemId,
							total,
						}),
				},
			);
			if (result.type !== "index")
				return yield* Effect.die(
					new Error("Estimate index worker returned an item result."),
				);

			return [
				...cachedByItemId.values(),
			]
				.map(projectEntry)
				.concat(result.entries)
				.sort((left, right) => left.itemId.localeCompare(right.itemId));
		}),
);
