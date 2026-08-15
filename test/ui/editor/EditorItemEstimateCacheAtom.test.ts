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
import type { EditorItemEstimatePersistenceService } from "~/ui/item/editor/EditorItemEstimatePersistence";

const simulation = (itemId: string, quantity = 1): EditorItemSimulation => ({
	blockers: [],
	chargeCost: [],
	cost: [],
	infrastructure: [],
	infrastructureItemIds: new Set(),
	itemId,
	operations: [],
	quantity,
	requiredInfrastructure: [],
	runtimeMs: 1,
	status: "estimated",
	totalChargeCost: 0,
	totalCostQuantity: 0,
	warnings: [],
});

const config = {
	items: {
		alpha: {},
		bravo: {},
		charlie: {},
	},
} as unknown as GameConfigSchema.Type;

const snapshot = (revision: number): EditorItemEstimateCacheAtom.Snapshot => ({
	config,
	projectId: "project",
	revision,
});

const persistence = (
	persisted: ReadonlyArray<EditorItemSimulation> = [],
): EditorItemEstimatePersistenceService => ({
	pruneProjectFx: vi.fn(() => Effect.void),
	readSnapshotFx: vi.fn(() => Effect.succeed(persisted)),
	writeEstimateFx: vi.fn(() => Effect.void),
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
	it("hydrates persistent engine estimates and only computes missing index items", async () => {
		const stored = persistence([
			simulation("alpha"),
		]);
		const computed: string[] = [];
		const atom = makeEditorItemEstimateCacheAtom({
			persistence: stored,
			runInWorkerFx: (request) => {
				computed.push(request.itemId);
				return Effect.succeed({
					estimate: simulation(request.itemId, request.quantity),
					type: "item" as const,
				});
			},
		});
		const registry = mount(atom);

		registry.set(atom, {
			snapshot: snapshot(1),
			type: "index",
		});
		const state = await waitFor(registry, atom, (current) => current.progress.completed === 3);

		expect(state.estimates.get("alpha")?.has(1)).toBe(true);
		expect(computed).toEqual([
			"bravo",
			"charlie",
		]);
		expect(stored.writeEstimateFx).toHaveBeenCalledTimes(2);
	});

	it("keeps the background queue alive and prioritizes a newly opened item", async () => {
		const completions = new Map<string, () => void>();
		const started: string[] = [];
		const atom = makeEditorItemEstimateCacheAtom({
			persistence: persistence(),
			runInWorkerFx: (request) =>
				Effect.callback((resume) => {
					started.push(request.itemId);
					completions.set(request.itemId, () =>
						resume(
							Effect.succeed({
								estimate: simulation(request.itemId, request.quantity),
								type: "item" as const,
							}),
						),
					);
				}),
		});
		const registry = mount(atom);
		const current = snapshot(1);

		registry.set(atom, {
			snapshot: current,
			type: "index",
		});
		await vi.waitFor(() =>
			expect(started).toEqual([
				"alpha",
			]),
		);
		registry.set(atom, {
			itemId: "charlie",
			quantity: 1,
			snapshot: current,
			type: "item",
		});
		completions.get("alpha")?.();
		await vi.waitFor(() =>
			expect(started).toEqual([
				"alpha",
				"charlie",
			]),
		);
		completions.get("charlie")?.();
		await vi.waitFor(() =>
			expect(started).toEqual([
				"alpha",
				"charlie",
				"bravo",
			]),
		);
		completions.get("bravo")?.();
		await waitFor(registry, atom, (state) => state.progress.completed === 3);
	});

	it("keeps quantities distinct and resets the cache authority on project revision changes", async () => {
		const stored = persistence();
		const atom = makeEditorItemEstimateCacheAtom({
			persistence: stored,
			runInWorkerFx: (request) =>
				Effect.succeed({
					estimate: simulation(request.itemId, request.quantity),
					type: "item" as const,
				}),
		});
		const registry = mount(atom);

		registry.set(atom, {
			itemId: "alpha",
			quantity: 2,
			snapshot: snapshot(1),
			type: "item",
		});
		await waitFor(registry, atom, (state) => state.estimates.get("alpha")?.has(2) === true);
		registry.set(atom, {
			itemId: "alpha",
			quantity: 1,
			snapshot: snapshot(2),
			type: "item",
		});
		const state = await waitFor(
			registry,
			atom,
			(current) =>
				current.snapshot?.revision === 2 && current.estimates.get("alpha")?.has(1) === true,
		);

		expect(state.estimates.get("alpha")?.has(2)).toBe(false);
		expect(stored.readSnapshotFx).toHaveBeenCalledTimes(2);
	});
});
