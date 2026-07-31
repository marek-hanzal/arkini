import { scheduleTask } from "@effect/atom-react";
import { Deferred, Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectFormDirtyAtom } from "~/bridge/editor/EditorProjectFormDirtyAtom";
import { runEditorProjectMutationFx } from "~/bridge/editor/EditorProjectMutationLane";
import {
	closeActiveEditorProjectSessionFx,
	closeEditorProjectSessionFx,
	openEditorProjectSession,
	releaseEditorProjectSession,
} from "~/bridge/editor/EditorProjectSession";

const registries: AtomRegistry.AtomRegistry[] = [];
const createRegistry = () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};
const runInRegistry = <A, E>(
	registry: AtomRegistry.AtomRegistry,
	effect: Effect.Effect<A, E, AtomRegistry.AtomRegistry>,
) => Effect.runPromise(effect.pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)));
const createProject = (revision: string): EditorProject => ({
	projectId: "project",
	revision,
	title: "Project",
	createdAtMs: 1,
	updatedAtMs: 1,
	fileIndex: {},
	itemSourcePaths: {},
	resources: [],
	resourceSourcePaths: {},
	diagnostics: [],
});

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
	releaseEditorProjectSession("project");
});

describe("EditorProjectSession", () => {
	it("closes admission and waits for an already admitted canonical mutation", async () => {
		const revisionA = "a".repeat(64);
		const revisionB = "b".repeat(64);
		const registry = createRegistry();
		registry.set(EditorProjectAtom("project"), {
			action: "refresh",
			expectedRevision: undefined,
			project: createProject(revisionA),
		});
		openEditorProjectSession("project");
		const mutationEntered = Effect.runSync(Deferred.make<void>());
		const finishMutation = Effect.runSync(Deferred.make<void>());
		const mutation = runInRegistry(
			registry,
			runEditorProjectMutationFx({
				expectedRevision: revisionA,
				projectId: "project",
				run: () =>
					Deferred.succeed(mutationEntered, undefined).pipe(
						Effect.andThen(Deferred.await(finishMutation)),
						Effect.as({
							project: createProject(revisionB),
							revision: revisionB,
						}),
					),
			}),
		);
		await Effect.runPromise(Deferred.await(mutationEntered));
		let closed = false;
		const close = runInRegistry(registry, closeEditorProjectSessionFx("project")).then(() => {
			closed = true;
		});
		await vi.waitFor(() => expect(closed).toBe(false));

		Effect.runSync(Deferred.succeed(finishMutation, undefined));
		await mutation;
		await close;
		expect(closed).toBe(true);

		await expect(
			runInRegistry(
				registry,
				runEditorProjectMutationFx({
					expectedRevision: revisionB,
					projectId: "project",
					run: () => Effect.die("must not run"),
				}),
			),
		).rejects.toThrow("no longer accepts mutations");
	});

	it("does not poison a clean session after a mutation failure", async () => {
		const registry = createRegistry();
		openEditorProjectSession("project");
		await expect(
			runInRegistry(
				registry,
				runEditorProjectMutationFx({
					expectedRevision: "a".repeat(64),
					projectId: "project",
					run: () => Effect.fail(new Error("write failed")),
				}),
			),
		).rejects.toThrow("write failed");

		await expect(
			runInRegistry(registry, closeEditorProjectSessionFx("project")),
		).resolves.toBeUndefined();
	});

	it("rejects close while an in-memory item is dirty and allows it after save", async () => {
		const registry = createRegistry();
		openEditorProjectSession("project");
		registry.set(EditorProjectFormDirtyAtom("project"), {
			dirty: true,
			ownerId: "item:test",
		});
		await expect(runInRegistry(registry, closeActiveEditorProjectSessionFx)).rejects.toThrow(
			"Save or discard the current form",
		);

		await expect(
			runInRegistry(
				registry,
				runEditorProjectMutationFx({
					expectedRevision: "a".repeat(64),
					projectId: "project",
					run: () =>
						Effect.succeed({
							project: createProject("b".repeat(64)),
							revision: "b".repeat(64),
						}),
				}),
			),
		).resolves.toMatchObject({
			revision: "b".repeat(64),
		});

		registry.set(EditorProjectFormDirtyAtom("project"), {
			dirty: false,
			ownerId: "item:test",
		});
		await expect(
			runInRegistry(registry, closeEditorProjectSessionFx("project")),
		).resolves.toBeUndefined();
	});
});
