import { scheduleTask } from "@effect/atom-react";
import { Deferred, Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import type {
	ProjectRepository as ProjectRepositoryContext,
	ProjectRepositoryService,
} from "~/project-authoring/service/ProjectRepository";

const state = vi.hoisted(() => ({
	gate: undefined as Deferred.Deferred<void> | undefined,
	optimize: vi.fn(),
	request: undefined as
		| {
				readonly onProgressFn?: (progress: {
					readonly completedResourceCount: number;
					readonly phase: "optimizing" | "saving";
					readonly totalResourceCount: number;
				}) => void;
		  }
		| undefined,
}));

vi.mock("~/asset-authoring/fx/optimizeEditorResourcesFx", () => ({
	optimizeEditorResourcesFx: state.optimize,
}));

vi.mock("~/application-runtime/service/RendererRuntime", async () => {
	const { Effect } = await import("effect");
	const { ProjectRepository } = await import("~/project-authoring/service/ProjectRepository");
	return {
		RendererRuntime: {
			runSync: <Value, Failure>(
				effect: Effect.Effect<Value, Failure, ProjectRepositoryContext>,
			) =>
				Effect.runSync(
					effect.pipe(
						Effect.provideService(ProjectRepository, {} as ProjectRepositoryService),
					),
				),
		},
	};
});

import { EditorResourceOptimizationAtom } from "~/asset-authoring/atom/EditorResourceOptimizationAtom";

const registries: AtomRegistry.AtomRegistry[] = [];
const project = {
	createdAtMs: 1,
	projectId: "editor-test",
	revision: 4,
	title: editorTestPayload.config.meta.title,
	updatedAtMs: 2,
	version: editorTestPayload.version,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
};

beforeEach(() => {
	state.gate = Effect.runSync(Deferred.make<void>());
	state.optimize.mockReset();
	state.request = undefined;
	state.optimize.mockImplementation((request) => {
		state.request = request;
		if (state.gate === undefined) throw new Error("Expected optimization gate.");
		return Deferred.await(state.gate).pipe(
			Effect.as({
				optimizedBytes: 10,
				optimizedResourceCount: 2,
				originalBytes: 20,
				project,
			}),
		);
	});
});

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("EditorResourceOptimizationAtom", () => {
	it("keeps optimization and its latest progress alive across route unmount", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 10,
			scheduleTask,
		});
		registries.push(registry);
		const optimizationAtom = EditorResourceOptimizationAtom(project.projectId);
		const unmount = registry.mount(optimizationAtom);

		registry.set(optimizationAtom, {
			expectedRevision: project.revision,
			totalResourceCount: 4,
		});
		await vi.waitFor(() => expect(state.request).toBeDefined());
		state.request?.onProgressFn?.({
			completedResourceCount: 2,
			phase: "optimizing",
			totalResourceCount: 4,
		});
		expect(registry.get(optimizationAtom)).toEqual({
			kind: "optimizing",
			progress: {
				completedResourceCount: 2,
				phase: "optimizing",
				totalResourceCount: 4,
			},
		});

		unmount();
		await new Promise((resolveFn) => setTimeout(resolveFn, 20));
		state.request?.onProgressFn?.({
			completedResourceCount: 3,
			phase: "optimizing",
			totalResourceCount: 4,
		});
		const remount = registry.mount(optimizationAtom);
		expect(registry.get(optimizationAtom)).toEqual({
			kind: "optimizing",
			progress: {
				completedResourceCount: 3,
				phase: "optimizing",
				totalResourceCount: 4,
			},
		});
		expect(state.optimize).toHaveBeenCalledOnce();

		if (state.gate === undefined) throw new Error("Expected optimization gate.");
		Effect.runSync(Deferred.succeed(state.gate, undefined));
		await vi.waitFor(() =>
			expect(registry.get(optimizationAtom)).toMatchObject({
				kind: "success",
			}),
		);
		remount();
	});
});
