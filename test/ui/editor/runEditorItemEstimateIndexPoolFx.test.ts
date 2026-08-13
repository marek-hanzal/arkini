import { Effect, Fiber } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { EditorItemEstimateIndexEntry } from "~/editor/EditorItemEstimateIndex";
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

const structuralEntry = (itemId: string, runtimeMs: number): EditorItemEstimateIndexEntry => ({
	itemId,
	method: "structural-heuristic",
	runtimeMs,
	status: "estimated",
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
	it("runs every missing item in one planner-native worker", async () => {
		const started: string[][] = [];
		let complete: (() => void) | undefined;
		const fiber = Effect.runFork(
			runEditorItemEstimateIndexPoolFx(config, {
				runInWorkerFx: (request) =>
					Effect.callback((resume) => {
						if (request.type !== "index") throw new Error("Expected index request.");
						started.push([
							...request.itemIds,
						]);
						complete = () =>
							resume(
								Effect.succeed({
									entries: request.itemIds.map((itemId) =>
										structuralEntry(itemId, 1),
									),
									type: "index" as const,
								}),
							);
					}),
			}),
		);

		await vi.waitFor(() => expect(started).toHaveLength(1));
		complete?.();
		const entries = await Effect.runPromise(Fiber.join(fiber));

		expect(started[0]?.sort()).toEqual([
			"alpha",
			"bravo",
			"charlie",
			"delta",
		]);
		expect(entries).toHaveLength(4);
	});

	it("merges cached engine results, translates progress, and sorts entries", async () => {
		const requests: string[][] = [];
		const progress: number[] = [];
		const entries = await Effect.runPromise(
			runEditorItemEstimateIndexPoolFx(config, {
				cachedEstimates: [
					simulation("alpha", 99),
				],
				onProgress: (update) => progress.push(update.completed),
				runInWorkerFx: (request, options) =>
					Effect.sync(() => {
						if (request.type !== "index") throw new Error("Expected index request.");
						requests.push([
							...request.itemIds,
						]);
						for (const [index, itemId] of request.itemIds.entries())
							options?.onProgress?.({
								completed: index + 1,
								itemId,
								total: request.itemIds.length,
							});
						return {
							entries: request.itemIds.map((itemId) =>
								structuralEntry(itemId, itemId.length),
							),
							type: "index" as const,
						};
					}),
			}),
		);

		expect(requests).toEqual([
			[
				"bravo",
				"charlie",
				"delta",
			],
		]);
		expect(progress).toEqual([
			2,
			3,
			4,
		]);
		expect(entries.map((entry) => entry.itemId)).toEqual([
			"alpha",
			"bravo",
			"charlie",
			"delta",
		]);
		expect(entries[0]).toMatchObject({
			method: "engine-backed",
			runtimeMs: 99,
			status: "estimated",
		});
	});

	it("spawns no worker when every item has an engine-backed cache entry", async () => {
		const runInWorkerFx = vi.fn();
		const entries = await Effect.runPromise(
			runEditorItemEstimateIndexPoolFx(config, {
				cachedEstimates: Object.keys(config.items).map((itemId) => simulation(itemId, 1)),
				runInWorkerFx,
			}),
		);

		expect(runInWorkerFx).not.toHaveBeenCalled();
		expect(entries).toHaveLength(4);
		expect(entries.every(({ method }) => method === "engine-backed")).toBe(true);
	});
});
