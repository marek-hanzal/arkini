import { Effect, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { EditorBoardGameResourceOwnerAtom } from "~/editor-board/atom/EditorBoardGameResourceOwnerAtom";
import type { EditorBoardGameResource } from "~/editor-board/service/EditorBoardGameResource";
import type { Project, ProjectCommit } from "~/project-authoring/type/Project";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

const registries: AtomRegistry.AtomRegistry[] = [];

const createProject = (revision: number): Project => ({
	projectId: "project",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: revision + 1,
	revision,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
});

const createCommit = (previousRevision: number, revision: number): ProjectCommit => {
	const { resources: _resources, ...project } = createProject(revision);
	return {
		...project,
		previousRevision,
	};
};

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("publishEditorProjectFx", () => {
	it("rebuilds the latest composed revision when a delayed noop commit publishes", async () => {
		const registry = AtomRegistry.make();
		registries.push(registry);
		const projectAtom = EditorProjectAtom("project");
		registry.mount(projectAtom);
		registry.set(projectAtom, {
			project: createProject(0),
		});
		await Effect.runPromise(
			Atom.set(projectAtom, {
				commit: createCommit(1, 2),
			}).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)),
		);
		const publishFx = vi.fn<EditorBoardGameResource["publishFx"]>(() => Effect.void);
		const advanceNoopFx = vi.fn<EditorBoardGameResource["advanceNoopFx"]>(() => Effect.void);
		const owner: EditorBoardGameResource = {
			state: Effect.runSync(
				SubscriptionRef.make<EditorBoardGameResource.State>({
					type: "idle",
				}),
			),
			syncFx: () => Effect.void,
			publishFx,
			advanceNoopFx,
			replaceFx: () => Effect.void,
			releaseCurrentFx: Effect.void,
			shutdownFx: Effect.void,
		};
		await Effect.runPromise(
			Atom.set(EditorBoardGameResourceOwnerAtom, owner).pipe(
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);

		await Effect.runPromise(
			publishEditorProjectFx(
				"project",
				{
					commit: createCommit(0, 1),
				},
				"advance-noop",
			).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)),
		);

		expect(advanceNoopFx).not.toHaveBeenCalled();
		expect(publishFx).toHaveBeenCalledWith(
			expect.objectContaining({
				revision: 2,
			}),
		);
		expect(registry.get(projectAtom)?.revision).toBe(2);
	});
});
