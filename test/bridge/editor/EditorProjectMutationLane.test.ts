import { scheduleTask } from "@effect/atom-react";
import { Deferred, Effect, Fiber } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { runEditorProjectMutationFx } from "~/bridge/editor/runEditorProjectMutationFx";

const registries: AtomRegistry.AtomRegistry[] = [];
const createRegistry = () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

const createProject = (revision: string): EditorProject => ({
	projectId: "project",
	title: "Project",
	createdAtMs: 1,
	updatedAtMs: 1,
	revision,
	fileIndex: {},
	itemSourcePaths: {},
	resources: [],
	resourceSourcePaths: {},
	diagnostics: [],
});

const runInRegistry = <A, E>(
	registry: AtomRegistry.AtomRegistry,
	effect: Effect.Effect<A, E, AtomRegistry.AtomRegistry>,
) => Effect.runPromise(effect.pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)));

describe("EditorProjectMutationLane", () => {
	it("serializes three same-revision mutations across the complete lane lineage", async () => {
		const revisionA = "a".repeat(64);
		const revisionB = "b".repeat(64);
		const revisionC = "c".repeat(64);
		const revisionD = "d".repeat(64);
		const registry = createRegistry();
		registry.set(EditorProjectAtom("project"), {
			action: "refresh",
			expectedRevision: revisionA,
			project: createProject(revisionA),
		});
		const firstGate = Effect.runSync(
			Deferred.make<{
				readonly project: EditorProject;
				readonly revision: string;
			}>(),
		);
		const seenRevisions: string[] = [];
		const first = runInRegistry(
			registry,
			runEditorProjectMutationFx({
				expectedRevision: revisionA,
				projectId: "project",
				run: (expectedRevision) => {
					seenRevisions.push(expectedRevision);
					return Deferred.await(firstGate);
				},
			}),
		);
		await vi.waitFor(() =>
			expect(seenRevisions).toEqual([
				revisionA,
			]),
		);
		const second = runInRegistry(
			registry,
			runEditorProjectMutationFx({
				expectedRevision: revisionA,
				projectId: "project",
				run: (expectedRevision) => {
					seenRevisions.push(expectedRevision);
					return Effect.succeed({
						project: createProject(revisionC),
						revision: revisionC,
					});
				},
			}),
		);
		const third = runInRegistry(
			registry,
			runEditorProjectMutationFx({
				expectedRevision: revisionA,
				projectId: "project",
				run: (expectedRevision) => {
					seenRevisions.push(expectedRevision);
					return Effect.succeed({
						project: createProject(revisionD),
						revision: revisionD,
					});
				},
			}),
		);
		await Effect.runPromise(
			Deferred.succeed(firstGate, {
				project: createProject(revisionB),
				revision: revisionB,
			}),
		);

		await expect(first).resolves.toEqual({
			project: createProject(revisionB),
			revision: revisionB,
		});
		await expect(second).resolves.toEqual({
			project: createProject(revisionC),
			revision: revisionC,
		});
		await expect(third).resolves.toEqual({
			project: createProject(revisionD),
			revision: revisionD,
		});
		expect(seenRevisions).toEqual([
			revisionA,
			revisionB,
			revisionC,
		]);
		expect(registry.get(EditorProjectAtom("project"))?.revision).toBe(revisionD);
	});

	it("continues the lane after an ordinary mutation failure", async () => {
		const revisionA = "a".repeat(64);
		const revisionB = "b".repeat(64);
		const registry = createRegistry();
		registry.set(EditorProjectAtom("project"), {
			action: "refresh",
			expectedRevision: revisionA,
			project: createProject(revisionA),
		});
		const firstGate = Effect.runSync(Deferred.make<void>());
		const failure = new Error("invalid first mutation");
		const seenRevisions: string[] = [];
		const first = runInRegistry(
			registry,
			runEditorProjectMutationFx({
				expectedRevision: revisionA,
				projectId: "project",
				run: (expectedRevision) => {
					seenRevisions.push(expectedRevision);
					return Deferred.await(firstGate).pipe(Effect.andThen(Effect.fail(failure)));
				},
			}),
		);
		await vi.waitFor(() =>
			expect(seenRevisions).toEqual([
				revisionA,
			]),
		);
		const second = runInRegistry(
			registry,
			runEditorProjectMutationFx({
				expectedRevision: revisionA,
				projectId: "project",
				run: (expectedRevision) => {
					seenRevisions.push(expectedRevision);
					return Effect.succeed({
						project: createProject(revisionB),
						revision: revisionB,
					});
				},
			}),
		);
		await Effect.runPromise(Deferred.succeed(firstGate, undefined));

		await expect(first).rejects.toThrow(failure);
		await expect(second).resolves.toEqual({
			project: createProject(revisionB),
			revision: revisionB,
		});
		expect(seenRevisions).toEqual([
			revisionA,
			revisionA,
		]);
	});

	it("starts a fresh queued batch after the preceding revision fails", async () => {
		const revisionA = "a".repeat(64);
		const revisionB = "b".repeat(64);
		const revisionC = "c".repeat(64);
		const registry = createRegistry();
		const gate = Effect.runSync(Deferred.make<void>());
		const seenRevisions: string[] = [];
		const first = runInRegistry(
			registry,
			runEditorProjectMutationFx({
				expectedRevision: revisionA,
				projectId: "project",
				run: (expectedRevision) => {
					seenRevisions.push(expectedRevision);
					return Deferred.await(gate).pipe(
						Effect.andThen(Effect.fail(new Error("stale revision"))),
					);
				},
			}),
		);
		await vi.waitFor(() =>
			expect(seenRevisions).toEqual([
				revisionA,
			]),
		);
		const second = runInRegistry(
			registry,
			runEditorProjectMutationFx({
				expectedRevision: revisionB,
				projectId: "project",
				run: (expectedRevision) => {
					seenRevisions.push(expectedRevision);
					return Effect.succeed({
						project: createProject(revisionC),
						revision: revisionC,
					});
				},
			}),
		);
		await Effect.runPromise(Deferred.succeed(gate, undefined));

		await expect(first).rejects.toThrow("stale revision");
		await expect(second).resolves.toEqual({
			project: createProject(revisionC),
			revision: revisionC,
		});
		expect(seenRevisions).toEqual([
			revisionA,
			revisionB,
		]);
	});

	it("finishes an admitted mutation after its caller is interrupted", async () => {
		const revisionA = "a".repeat(64);
		const revisionB = "b".repeat(64);
		const revisionC = "c".repeat(64);
		const registry = createRegistry();
		const entered = Effect.runSync(Deferred.make<void>());
		const finish = Effect.runSync(Deferred.make<void>());
		const fiber = Effect.runFork(
			runEditorProjectMutationFx({
				expectedRevision: revisionA,
				projectId: "project",
				run: () =>
					Deferred.succeed(entered, undefined).pipe(
						Effect.andThen(Deferred.await(finish)),
						Effect.as({
							project: createProject(revisionB),
							revision: revisionB,
						}),
					),
			}).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)),
		);
		await Effect.runPromise(Deferred.await(entered));

		let interruptSettled = false;
		const interrupted = Effect.runPromise(Fiber.interrupt(fiber)).then((exit) => {
			interruptSettled = true;
			return exit;
		});
		await vi.waitFor(() => expect(interruptSettled).toBe(false));

		Effect.runSync(Deferred.succeed(finish, undefined));
		await interrupted;
		expect(registry.get(EditorProjectAtom("project"))?.revision).toBe(revisionB);

		await expect(
			runInRegistry(
				registry,
				runEditorProjectMutationFx({
					expectedRevision: revisionB,
					projectId: "project",
					run: () =>
						Effect.succeed({
							project: createProject(revisionC),
							revision: revisionC,
						}),
				}),
			),
		).resolves.toEqual({
			project: createProject(revisionC),
			revision: revisionC,
		});
	});
});
