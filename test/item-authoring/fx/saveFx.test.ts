import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Project } from "~/project-authoring/type/Project";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import {
	ProjectRepository,
	type ProjectRepositoryService,
} from "~/project-authoring/service/ProjectRepository";
import { saveFx } from "~/item-authoring/fx/saveFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const registries: AtomRegistry.AtomRegistry[] = [];

const createProject = (revision = 0): Project => ({
	projectId: "project",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: revision + 1,
	revision,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
});

const createFixture = () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	const upsertItemFx = vi.fn<ProjectRepositoryService["upsertItemFx"]>(({ item }) => {
		const { resources: _resources, ...commit } = createProject(1);
		return Effect.succeed({
			...commit,
			previousRevision: 0,
			config: {
				...editorTestPayload.config,
				items: {
					...editorTestPayload.config.items,
					[item.id]: item,
				},
			},
		});
	});
	const replaceConfigFx = vi.fn<ProjectRepositoryService["replaceConfigFx"]>(({ config }) => {
		const { resources: _resources, ...commit } = createProject(1);
		return Effect.succeed({
			...commit,
			previousRevision: 0,
			config,
		});
	});
	const repository: ProjectRepositoryService = {
		...UnusedEditorProjectRepository,
		awaitIdleFx: Effect.void,
		createProjectFx: () => Effect.die("Unexpected create."),
		listProjectsFx: Effect.die("Unexpected list."),
		readProjectFx: () => Effect.die("Unexpected read."),
		replaceConfigFx,
		replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
		deleteItemFx: () => Effect.die("Unexpected item delete."),
		upsertItemFx,
		upsertResourcesFx: () => Effect.die("Unexpected resource save."),
	};
	return {
		registry,
		repository,
		replaceConfigFx,
		upsertItemFx,
	};
};

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("saveFx", () => {
	it("validates, commits and publishes one explicit item save", async () => {
		const fixture = createFixture();
		const resources = editorTestPayload.resources;
		const projectAtom = EditorProjectAtom("project");
		fixture.registry.mount(projectAtom);
		fixture.registry.set(projectAtom, {
			project: {
				...createProject(),
				resources,
			},
		});
		const item = {
			...editorTestPayload.config.items.water,
			title: "Edited water",
		};
		const saved = await Effect.runPromise(
			saveFx({
				config: editorTestPayload.config,
				expectedRevision: 0,
				projectId: "project",
				item,
			}).pipe(
				Effect.provideService(ProjectRepository, fixture.repository),
				Effect.provideService(AtomRegistry.AtomRegistry, fixture.registry),
			),
		);

		expect(saved).toEqual(item);
		expect(fixture.upsertItemFx).toHaveBeenCalledWith({
			expectedRevision: 0,
			projectId: "project",
			item,
		});
		expect(fixture.registry.get(projectAtom)?.revision).toBe(1);
		expect(fixture.registry.get(projectAtom)?.resources).toBe(resources);
	});

	it("renames one saved UID and every exact reference in one revision-pinned commit", async () => {
		const fixture = createFixture();
		const projectAtom = EditorProjectAtom("project");
		fixture.registry.mount(projectAtom);
		fixture.registry.set(projectAtom, {
			project: createProject(),
		});
		const saved = await Effect.runPromise(
			saveFx({
				config: editorTestPayload.config,
				expectedRevision: 0,
				projectId: "project",
				item: {
					...editorTestPayload.config.items.water,
					id: "fresh-water",
				},
			}).pipe(
				Effect.provideService(ProjectRepository, fixture.repository),
				Effect.provideService(AtomRegistry.AtomRegistry, fixture.registry),
			),
		);

		expect(fixture.upsertItemFx).not.toHaveBeenCalled();
		expect(fixture.replaceConfigFx).toHaveBeenCalledWith(
			expect.objectContaining({
				expectedRevision: 0,
				projectId: "project",
			}),
		);
		expect(saved).toMatchObject({
			id: "fresh-water",
			uid: editorTestPayload.config.items.water?.uid,
		});
		expect(fixture.registry.get(projectAtom)?.config.start.board[0]?.itemId).toBe(
			"fresh-water",
		);
	});

	it("rejects an invalid item before repository admission", async () => {
		const fixture = createFixture();
		await expect(
			Effect.runPromise(
				saveFx({
					config: editorTestPayload.config,
					expectedRevision: 0,
					projectId: "project",
					item: {
						...editorTestPayload.config.items.water,
						id: "",
					},
				}).pipe(
					Effect.provideService(ProjectRepository, fixture.repository),
					Effect.provideService(AtomRegistry.AtomRegistry, fixture.registry),
				),
			),
		).rejects.toThrow("does not satisfy");
		expect(fixture.upsertItemFx).not.toHaveBeenCalled();
	});
});
