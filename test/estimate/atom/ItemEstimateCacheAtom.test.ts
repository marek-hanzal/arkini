import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ItemEstimate } from "~/estimate/type/ItemEstimate";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { ItemEstimateCacheAtom } from "~/estimate/atom/ItemEstimateCacheAtom";
import type { ItemEstimateSnapshot } from "~/estimate/fn/createItemEstimateSnapshotFn";

const runItemEstimateInWorkerFxMock = vi.hoisted(() => vi.fn());

vi.mock("~/estimate/worker/runItemEstimateInWorkerFx", () => ({
	runItemEstimateInWorkerFx: runItemEstimateInWorkerFxMock,
}));

const estimateFn = (factId: string): ItemEstimate => {
	const route = {
		actionRuns: 1,
		durationMs: 1,
		factId,
		outputRuns: 1,
		quantity: 1,
		requirements: [],
		rootQuantity: 0,
		routeId: `route:${factId}`,
		source: "route" as const,
	};
	return {
		diagnostics: [],
		durationMs: 1,
		factId,
		limitations: [],
		obtainable: true,
		requirementSummary: {
			consumed: [],
			oneTime: [],
			ongoing: [],
		},
		status: "complete",
		quantity: 1,
		route,
		routeSteps: [
			route,
		],
	};
};

const config = {
	items: {
		alpha: {},
		bravo: {},
	},
} as unknown as GameConfigSchema.Type;

const snapshot = (revision: number): ItemEstimateSnapshot => ({
	config,
	projectId: "project",
	revision,
});

const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
	vi.clearAllMocks();
});

const mount = () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	registry.mount(ItemEstimateCacheAtom);
	return registry;
};

describe("ItemEstimateCacheAtom", () => {
	it("computes one full-project batch for repeated requests of the same snapshot", async () => {
		let calls = 0;
		runItemEstimateInWorkerFxMock.mockImplementation(() => {
			calls += 1;
			return Effect.succeed({
				estimates: [
					estimateFn("alpha"),
					estimateFn("bravo"),
				],
			});
		});
		const registry = mount();

		registry.set(ItemEstimateCacheAtom, snapshot(1));
		registry.set(ItemEstimateCacheAtom, snapshot(1));
		await vi.waitFor(() => expect(registry.get(ItemEstimateCacheAtom).status).toBe("ready"));

		expect(calls).toBe(1);
		expect([
			...registry.get(ItemEstimateCacheAtom).estimates.keys(),
		]).toEqual([
			"alpha",
			"bravo",
		]);
	});

	it("interrupts an obsolete batch before publishing the replacement snapshot", async () => {
		let calls = 0;
		let interrupted = 0;
		runItemEstimateInWorkerFxMock.mockImplementation(() => {
			calls += 1;
			if (calls === 1)
				return Effect.callback(() =>
					Effect.sync(() => {
						interrupted += 1;
					}),
				);
			return Effect.succeed({
				estimates: [
					estimateFn("bravo"),
				],
			});
		});
		const registry = mount();

		registry.set(ItemEstimateCacheAtom, snapshot(1));
		await vi.waitFor(() => expect(calls).toBe(1));
		registry.set(ItemEstimateCacheAtom, snapshot(2));
		await vi.waitFor(() => expect(registry.get(ItemEstimateCacheAtom).status).toBe("ready"));
		await vi.waitFor(() => expect(interrupted).toBe(1));
		expect(registry.get(ItemEstimateCacheAtom).snapshot?.revision).toBe(2);
		expect([
			...registry.get(ItemEstimateCacheAtom).estimates.keys(),
		]).toEqual([
			"bravo",
		]);
	});

	it("publishes a batch error and lets the same snapshot retry", async () => {
		let calls = 0;
		runItemEstimateInWorkerFxMock.mockImplementation(() => {
			calls += 1;
			return calls === 1
				? Effect.fail(new Error("estimate exploded"))
				: Effect.succeed({
						estimates: [
							estimateFn("alpha"),
						],
					});
		});
		const registry = mount();

		registry.set(ItemEstimateCacheAtom, snapshot(1));
		await vi.waitFor(() => expect(registry.get(ItemEstimateCacheAtom).status).toBe("error"));

		expect(registry.get(ItemEstimateCacheAtom).message).toBe("estimate exploded");
		expect(registry.get(ItemEstimateCacheAtom).estimates.size).toBe(0);

		registry.set(ItemEstimateCacheAtom, snapshot(1));
		await vi.waitFor(() => expect(registry.get(ItemEstimateCacheAtom).status).toBe("ready"));
		expect(calls).toBe(2);
		expect(registry.get(ItemEstimateCacheAtom).estimates.has("alpha")).toBe(true);
	});
});
