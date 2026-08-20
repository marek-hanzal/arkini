import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorItemEstimate } from "~/editor/estimator/EditorItemEstimate";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import {
	type EditorItemEstimateCacheAtom,
	makeEditorItemEstimateCacheAtom,
} from "~/ui/item/editor/EditorItemEstimateCacheAtom";

const estimate = (factId: string): EditorItemEstimate => {
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

describe("EditorItemEstimateCacheAtom", () => {
	it("computes one full-project batch for repeated requests of the same snapshot", async () => {
		let calls = 0;
		const atom = makeEditorItemEstimateCacheAtom({
			runInWorkerFx: () => {
				calls += 1;
				return Effect.succeed({
					estimates: [
						estimate("alpha"),
						estimate("bravo"),
					],
				});
			},
		});
		const registry = mount(atom);

		registry.set(atom, snapshot(1));
		registry.set(atom, snapshot(1));
		await vi.waitFor(() => expect(registry.get(atom).status).toBe("ready"));

		expect(calls).toBe(1);
		expect([
			...registry.get(atom).estimates.keys(),
		]).toEqual([
			"alpha",
			"bravo",
		]);
	});

	it("interrupts an obsolete batch before publishing the replacement snapshot", async () => {
		let calls = 0;
		let interrupted = 0;
		const atom = makeEditorItemEstimateCacheAtom({
			runInWorkerFx: () => {
				calls += 1;
				if (calls === 1)
					return Effect.callback(() =>
						Effect.sync(() => {
							interrupted += 1;
						}),
					);
				return Effect.succeed({
					estimates: [
						estimate("bravo"),
					],
				});
			},
		});
		const registry = mount(atom);

		registry.set(atom, snapshot(1));
		await vi.waitFor(() => expect(calls).toBe(1));
		registry.set(atom, snapshot(2));
		await vi.waitFor(() => expect(registry.get(atom).status).toBe("ready"));
		await vi.waitFor(() => expect(interrupted).toBe(1));
		expect(registry.get(atom).snapshot?.revision).toBe(2);
		expect([
			...registry.get(atom).estimates.keys(),
		]).toEqual([
			"bravo",
		]);
	});

	it("publishes a batch error and lets the same snapshot retry", async () => {
		let calls = 0;
		const atom = makeEditorItemEstimateCacheAtom({
			runInWorkerFx: () => {
				calls += 1;
				return calls === 1
					? Effect.fail(new Error("estimate exploded"))
					: Effect.succeed({
							estimates: [
								estimate("alpha"),
							],
						});
			},
		});
		const registry = mount(atom);

		registry.set(atom, snapshot(1));
		await vi.waitFor(() => expect(registry.get(atom).status).toBe("error"));

		expect(registry.get(atom).message).toBe("estimate exploded");
		expect(registry.get(atom).estimates.size).toBe(0);

		registry.set(atom, snapshot(1));
		await vi.waitFor(() => expect(registry.get(atom).status).toBe("ready"));
		expect(calls).toBe(2);
		expect(registry.get(atom).estimates.has("alpha")).toBe(true);
	});
});
