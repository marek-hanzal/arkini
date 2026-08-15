import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { EditorItemSimulation } from "~/editor/simulator/EditorItemSimulation";
import {
	type EditorItemEstimateCacheAtom,
	makeEditorItemEstimateCacheAtom,
} from "~/ui/item/editor/EditorItemEstimateCacheAtom";

const simulation = (itemId: string, quantity = 1): EditorItemSimulation => ({
	blockers: [],
	cost: [],
	infrastructure: [],
	infrastructureItemIds: new Set(),
	itemId,
	operations: [],
	quantity,
	runtimeMs: 1,
	status: "estimated",
	totalCostQuantity: 0,
	warnings: [],
});

const config = {
	items: {
		alpha: {},
		bravo: {},
	},
} as unknown as GameConfigSchema.Type;

const snapshot = (revision: number): EditorItemEstimateCacheAtom.Snapshot => ({
	config,
	projectId: "project",
	revision,
});

const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

const mount = (atom: ReturnType<typeof makeEditorItemEstimateCacheAtom>) => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	registry.mount(atom);
	return registry;
};

const waitFor = async (
	registry: AtomRegistry.AtomRegistry,
	atom: ReturnType<typeof makeEditorItemEstimateCacheAtom>,
	predicate: (state: EditorItemEstimateCacheAtom.State) => boolean,
) => {
	await vi.waitFor(() => expect(predicate(registry.get(atom))).toBe(true));
	return registry.get(atom);
};

describe("EditorItemEstimateCacheAtom", () => {
	it("keeps the structural index separate from authoritative item estimates", async () => {
		const runIndexPoolFx = vi.fn(() =>
			Effect.succeed([
				{
					itemId: "alpha",
					method: "structural-heuristic" as const,
					runtimeMs: 1,
					status: "estimated" as const,
				},
			]),
		);
		const runInWorkerFx = vi.fn((request) =>
			Effect.succeed({
				estimate:
					request.type === "item"
						? simulation(request.itemId, request.quantity)
						: simulation(""),
				type: "item" as const,
			}),
		);
		const atom = makeEditorItemEstimateCacheAtom({
			runIndexPoolFx,
			runInWorkerFx,
		});
		const registry = mount(atom);
		const request = {
			snapshot: snapshot(1),
			type: "index" as const,
		};

		registry.set(atom, request);
		registry.set(atom, request);
		await waitFor(registry, atom, (state) => state.indexEntries !== undefined);
		registry.set(atom, request);
		registry.set(atom, {
			itemId: "alpha",
			quantity: 1,
			snapshot: snapshot(1),
			type: "item",
		});
		await waitFor(registry, atom, (state) => state.estimates.get("alpha")?.has(1) === true);

		expect(runIndexPoolFx).toHaveBeenCalledTimes(1);
		expect(runInWorkerFx).toHaveBeenCalledTimes(1);
		expect(registry.get(atom).estimates.get("alpha")?.get(1)).toEqual(simulation("alpha"));
	});

	it("keeps quantities distinct and rejects stale revision progress", async () => {
		let staleOptions:
			| {
					onProgress?: (progress: {
						readonly completed: number;
						readonly itemId: string;
						readonly total: number;
					}) => void;
			  }
			| undefined;
		const runIndexPoolFx = vi.fn((_config, options) => {
			staleOptions = options;
			return Effect.never;
		});
		const runInWorkerFx = vi.fn((request) =>
			Effect.succeed({
				estimate:
					request.type === "item"
						? simulation(request.itemId, request.quantity)
						: simulation(""),
				type: "item" as const,
			}),
		);
		const atom = makeEditorItemEstimateCacheAtom({
			runIndexPoolFx,
			runInWorkerFx,
		});
		const registry = mount(atom);

		registry.set(atom, {
			snapshot: snapshot(1),
			type: "index",
		});
		await vi.waitFor(() => expect(runIndexPoolFx).toHaveBeenCalledTimes(1));
		registry.set(atom, {
			itemId: "alpha",
			quantity: 2,
			snapshot: snapshot(2),
			type: "item",
		});
		await waitFor(registry, atom, (state) => state.estimates.get("alpha")?.has(2) === true);
		staleOptions?.onProgress?.({
			completed: 2,
			itemId: "bravo",
			total: 2,
		});

		const state = registry.get(atom);
		expect(state.snapshot?.revision).toBe(2);
		expect(state.estimates.get("alpha")?.has(1)).toBe(false);
		expect(state.estimates.get("alpha")?.has(2)).toBe(true);
		expect(state.progress.completed).toBe(0);
	});

	it("releases a queued index after item failure", async () => {
		const runIndexPoolFx = vi.fn(() => Effect.succeed([]));
		const runInWorkerFx = vi.fn(() => Effect.fail(new Error("item failed")));
		const atom = makeEditorItemEstimateCacheAtom({
			runIndexPoolFx,
			runInWorkerFx,
		});
		const registry = mount(atom);
		const current = snapshot(1);

		registry.set(atom, {
			itemId: "alpha",
			quantity: 1,
			snapshot: current,
			type: "item",
		});
		registry.set(atom, {
			snapshot: current,
			type: "index",
		});

		await vi.waitFor(() => expect(runIndexPoolFx).toHaveBeenCalledTimes(1));
	});

	it("releases a deferred item after index failure", async () => {
		let failIndex: (() => void) | undefined;
		const runIndexPoolFx = vi.fn(() =>
			Effect.callback<ReadonlyArray<never>, Error>((resume) => {
				failIndex = () => resume(Effect.fail(new Error("index failed")));
			}),
		);
		const runInWorkerFx = vi.fn((request) =>
			Effect.succeed({
				estimate:
					request.type === "item"
						? simulation(request.itemId, request.quantity)
						: simulation(""),
				type: "item" as const,
			}),
		);
		const atom = makeEditorItemEstimateCacheAtom({
			runIndexPoolFx,
			runInWorkerFx,
		});
		const registry = mount(atom);
		const current = snapshot(1);

		registry.set(atom, {
			snapshot: current,
			type: "index",
		});
		await vi.waitFor(() => expect(failIndex).toBeTypeOf("function"));
		registry.set(atom, {
			itemId: "alpha",
			quantity: 1,
			snapshot: current,
			type: "item",
		});
		failIndex?.();

		await waitFor(registry, atom, (state) => state.estimates.get("alpha")?.has(1) === true);
		expect(runInWorkerFx).toHaveBeenCalledTimes(1);
	});
});
