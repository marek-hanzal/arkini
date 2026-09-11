import { scheduleTask } from "@effect/atom-react";
import { Effect, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Project } from "~/project-authoring/type/Project";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { EditorBoardGameResourceOwnerAtom } from "~/editor-board/atom/EditorBoardGameResourceOwnerAtom";
import type { EditorBoardGameResource } from "~/editor-board/service/EditorBoardGameResource";
import {
	ProjectRepository,
	type ProjectRepositoryService,
} from "~/project-authoring/service/ProjectRepository";
import { saveDraftStatusFx } from "~/item-authoring/fx/saveDraftStatusFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

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

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("saveDraftStatusFx", () => {
	it("publishes the persisted flag as a Board version-noop", async () => {
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const item = editorTestPayload.config.items.water;
		if (item === undefined) throw new Error("Missing water fixture.");
		const upsertItemFx = vi.fn<ProjectRepositoryService["upsertItemFx"]>(({ item: saved }) => {
			const { resources: _resources, ...commit } = createProject(1);
			return Effect.succeed({
				...commit,
				previousRevision: 0,
				config: {
					...editorTestPayload.config,
					items: {
						...editorTestPayload.config.items,
						[saved.id]: saved,
					},
				},
			});
		});
		const repository: ProjectRepositoryService = {
			...UnusedEditorProjectRepository,
			awaitIdleFx: Effect.void,
			createProjectFx: () => Effect.die("Unexpected project create."),
			deleteItemFx: () => Effect.die("Unexpected item delete."),
			listProjectsFx: Effect.die("Unexpected project list."),
			readProjectFx: () => Effect.die("Unexpected project read."),
			replaceConfigFx: () => Effect.die("Unexpected config replacement."),
			replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
			upsertItemFx,
			upsertResourcesFx: () => Effect.die("Unexpected resource save."),
		};
		const advanceNoopFx = vi.fn<EditorBoardGameResource["advanceNoopFx"]>(() => Effect.void);
		const publishFx = vi.fn<EditorBoardGameResource["publishFx"]>(() =>
			Effect.die("Draft status must not rebuild the Board game."),
		);
		const board: EditorBoardGameResource = {
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
		const projectAtom = EditorProjectAtom("project");
		registry.mount(projectAtom);
		registry.set(projectAtom, {
			project: createProject(0),
		});
		Effect.runSync(
			Atom.set(EditorBoardGameResourceOwnerAtom, board).pipe(
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);

		const saved = await Effect.runPromise(
			saveDraftStatusFx({
				config: editorTestPayload.config,
				draft: true,
				expectedRevision: 0,
				itemId: item.id,
				projectId: "project",
			}).pipe(
				Effect.provideService(ProjectRepository, repository),
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);

		expect(saved.draft).toBe(true);
		expect(upsertItemFx).toHaveBeenCalledWith({
			expectedRevision: 0,
			projectId: "project",
			item: {
				...item,
				draft: true,
			},
		});
		expect(publishFx).not.toHaveBeenCalled();
		expect(advanceNoopFx).toHaveBeenCalledWith(
			expect.objectContaining({
				revision: 1,
			}),
			0,
		);
		expect(registry.get(projectAtom)?.config.items.water?.draft).toBe(true);
	});
});
