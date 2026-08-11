import { Effect, Fiber } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { EditorItemSimulation } from "~/editor/simulator/EditorItemSimulation";
import { runEditorItemEstimateIndexPoolFx } from "~/ui/item/editor/runEditorItemEstimateIndexPoolFx";

const simulation = (itemId: string, runtimeMs: number): EditorItemSimulation => ({
	blockers: [],
	cost: [],
	infrastructureItemIds: new Set(),
	itemId,
	operations: [],
	quantity: 1,
	runtimeMs,
	status: "estimated",
	totalCostQuantity: 0,
	warnings: [],
});

const config = {
	items: Object.fromEntries(
		[
			"delta",
			"alpha",
			"charlie",
			"bravo",
		].map((itemId) => [
			itemId,
			{},
		]),
	),
} as unknown as GameConfigSchema.Type;

describe("runEditorItemEstimateIndexPoolFx", () => {
	it("starts every pool worker before any worker completes", async () => {
		const started: string[][] = [];
		const complete: Array<() => void> = [];
		const fiber = Effect.runFork(
			runEditorItemEstimateIndexPoolFx(config, {
				poolSize: 3,
				runInWorkerFx: (request) =>
					Effect.callback((resume) => {
						if (request.type !== "index") throw new Error("Expected index request.");
						started.push([
							...request.itemIds,
						]);
						complete.push(() =>
							resume(
								Effect.succeed({
									entries: request.itemIds.map((itemId) => ({
										runtimeMs: 1,
										itemId,
									})),
									type: "index" as const,
								}),
							),
						);
					}),
			}),
		);

		await vi.waitFor(() => expect(started).toHaveLength(3));
		for (const finish of complete) finish();
		const entries = await Effect.runPromise(Fiber.join(fiber));

		expect(entries).toHaveLength(4);
	});

	it("uses at most three workers, aggregates monotonic progress, and sorts entries", async () => {
		const requests: string[][] = [];
		const progress: number[] = [];
		const entries = await Effect.runPromise(
			runEditorItemEstimateIndexPoolFx(config, {
				onProgress: (update) => progress.push(update.completed),
				poolSize: 99,
				runInWorkerFx: (request, options) =>
					Effect.sync(() => {
						if (request.type !== "index") throw new Error("Expected index request.");
						requests.push([
							...request.itemIds,
						]);
						for (const [index, itemId] of request.itemIds.entries()) {
							const estimate = simulation(itemId, itemId.length);
							options?.onEstimate?.(estimate);
							options?.onProgress?.({
								completed: index + 1,
								itemId,
								total: request.itemIds.length,
							});
						}
						return {
							entries: request.itemIds.map((itemId) => ({
								runtimeMs: itemId.length,
								itemId,
							})),
							type: "index" as const,
						};
					}),
			}),
		);

		expect(requests).toHaveLength(3);
		expect(requests.flat().sort()).toEqual([
			"alpha",
			"bravo",
			"charlie",
			"delta",
		]);
		expect(progress).toEqual(
			[
				...progress,
			].sort((left, right) => left - right),
		);
		expect(entries.map((entry) => entry.itemId)).toEqual([
			"alpha",
			"bravo",
			"charlie",
			"delta",
		]);
	});

	it("spawns no worker when every item is cached", async () => {
		const runInWorkerFx = vi.fn();
		const entries = await Effect.runPromise(
			runEditorItemEstimateIndexPoolFx(config, {
				cachedEstimates: Object.keys(config.items).map((itemId) => simulation(itemId, 1)),
				runInWorkerFx,
			}),
		);

		expect(runInWorkerFx).not.toHaveBeenCalled();
		expect(entries).toHaveLength(4);
	});
});
