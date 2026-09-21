import { scheduleTask } from "@effect/atom-react";
import { Cause, Deferred, Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	editorTestResources,
	editorTestPayload,
} from "~test/project-authoring/support/editorTestPayload";
import type {
	ProjectRepository as ProjectRepositoryContext,
	ProjectRepositoryService,
} from "~/project-authoring/service/ProjectRepository";

const state = vi.hoisted(() => ({
	gate: undefined as Deferred.Deferred<void> | undefined,
	optimize: vi.fn(),
	request: undefined as
		| {
				readonly expectedRevision: number;
				readonly onProgressFn?: (progress: {
					readonly completedResourceCount: number;
					readonly phase: "optimizing" | "saving";
					readonly totalResourceCount: number;
				}) => void;
				readonly projectId: string;
				readonly resourceIds: ReadonlyArray<string>;
				readonly type: "artwork" | "sfx";
		  }
		| undefined,
}));

vi.mock("~/resource-authoring/fx/optimizeEditorResourcesFx", () => ({
	optimizeEditorResourcesFx: state.optimize,
}));

vi.mock("~/application-runtime/service/RendererRuntime", async () => {
	const { Effect } = await import("effect");
	const { ProjectRepository } = await import("~/project-authoring/service/ProjectRepository");
	const { ProjectWriteAdmission } = await import(
		"~/project-authoring/service/ProjectWriteAdmission"
	);
	const { createProjectWriteAdmissionFx } = await import(
		"~/project-authoring/fx/createProjectWriteAdmissionFx"
	);
	const admission = Effect.runSync(createProjectWriteAdmissionFx);
	return {
		RendererRuntime: {
			runSync: <Value, Failure>(
				effect: Effect.Effect<Value, Failure, ProjectRepositoryContext>,
			) =>
				Effect.runSync(
					effect.pipe(
						Effect.provideService(ProjectRepository, {} as ProjectRepositoryService),
						Effect.provideService(ProjectWriteAdmission, admission),
					),
				),
		},
	};
});

import { EditorResourceOptimizationAtom } from "~/resource-authoring/atom/EditorResourceOptimizationAtom";

const registries: AtomRegistry.AtomRegistry[] = [];
const project = {
	createdAtMs: 1,
	projectId: "editor-test",
	revision: 4,
	title: editorTestPayload.config.meta.title,
	updatedAtMs: 2,
	version: {
		major: 1,
		minor: 0,
	},
	config: editorTestPayload.config,
	resources: editorTestResources,
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
				processedResourceCount: 4,
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
			kind: "optimize",
			resourceIds: [
				"one",
				"two",
				"three",
				"four",
			],
			type: "artwork",
		});
		await vi.waitFor(() => expect(state.request).toBeDefined());
		expect(state.request).toMatchObject({
			expectedRevision: project.revision,
			projectId: project.projectId,
			resourceIds: [
				"one",
				"two",
				"three",
				"four",
			],
		});
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
			type: "artwork",
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
			type: "artwork",
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

	it("clears a settled result when dismissed", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 10,
			scheduleTask,
		});
		registries.push(registry);
		const optimizationAtom = EditorResourceOptimizationAtom(project.projectId);
		const unmount = registry.mount(optimizationAtom);

		registry.set(optimizationAtom, {
			expectedRevision: project.revision,
			kind: "optimize",
			resourceIds: [
				"one",
			],
			type: "artwork",
		});
		await vi.waitFor(() => expect(state.request).toBeDefined());
		if (state.gate === undefined) throw new Error("Expected optimization gate.");
		Effect.runSync(Deferred.succeed(state.gate, undefined));
		await vi.waitFor(() =>
			expect(registry.get(optimizationAtom)).toMatchObject({
				kind: "success",
			}),
		);

		registry.set(optimizationAtom, {
			kind: "dismiss",
		});

		expect(registry.get(optimizationAtom)).toEqual({
			kind: "idle",
		});
		unmount();
	});
	it("keeps one typed optimization failure dismissible without changing its identity", async () => {
		const error = new Error("resource conversion failed");
		state.optimize.mockReturnValue(Effect.fail(error));
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const atom = EditorResourceOptimizationAtom("typed-failure-project");
		const unmount = registry.mount(atom);
		registry.set(atom, {
			kind: "optimize",
			expectedRevision: 4,
			resourceIds: [
				"one",
			],
			type: "artwork",
		});
		await vi.waitFor(() =>
			expect(registry.get(atom)).toMatchObject({
				kind: "failure",
			}),
		);
		const settled = registry.get(atom);
		if (settled.kind !== "failure") throw new Error("Expected typed optimization failure.");
		expect(settled.error).toBe(error);
		registry.set(atom, {
			kind: "dismiss",
		});
		expect(registry.get(atom)).toEqual({
			kind: "idle",
		});
		unmount();
	});

	it.each([
		"defect",
		"mixed",
		"interrupt",
	] as const)("propagates the complete %s cause across optimization remount", async (kind) => {
		const defect = new Error("project publication defect");
		const cause =
			kind === "defect"
				? Cause.die(defect)
				: kind === "mixed"
					? Cause.combine(Cause.fail(new Error("conversion failure")), Cause.die(defect))
					: Cause.interrupt(123);
		state.optimize.mockReturnValue(
			kind === "mixed"
				? Effect.yieldNow.pipe(Effect.andThen(Effect.failCause(cause)))
				: Effect.failCause(cause),
		);
		const registry = AtomRegistry.make({
			scheduleTask,
			defaultIdleTTL: 10,
		});
		registries.push(registry);
		const atom = EditorResourceOptimizationAtom(`fatal-${kind}-project`);
		const unmount = registry.mount(atom);
		try {
			registry.set(atom, {
				kind: "optimize",
				expectedRevision: 4,
				resourceIds: [
					"one",
				],
				type: "artwork",
			});
		} catch (error) {
			expect(error).toBe(cause);
		}
		const readThrown = () => {
			try {
				registry.get(atom);
			} catch (error) {
				return error;
			}
			return undefined;
		};
		await vi.waitFor(() => expect(readThrown()).toBe(cause));
		unmount();
		await new Promise((resolve) => setTimeout(resolve, 20));
		let remount: (() => void) | undefined;
		try {
			remount = registry.mount(atom);
		} catch (error) {
			expect(error).toBe(cause);
		}
		expect(readThrown()).toBe(cause);
		remount?.();
		expect(state.optimize).toHaveBeenCalledOnce();
	});
});
