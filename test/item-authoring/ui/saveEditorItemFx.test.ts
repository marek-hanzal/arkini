import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/editor/EditorProject";
import { EditorProjectAtom } from "~/ui/editor/EditorProjectAtom";
import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/editor/EditorProjectRepository";
import { saveEditorItemFx } from "~/item-authoring/ui/saveEditorItemFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const registries: AtomRegistry.AtomRegistry[] = [];

const createProject = (revision = 0): EditorProject => ({
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
	const upsertItemFx = vi.fn<EditorProjectRepositoryService["upsertItemFx"]>(({ item }) => {
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
	const repository: EditorProjectRepositoryService = {
		...UnusedEditorProjectRepository,
		awaitIdleFx: Effect.void,
		createProjectFx: () => Effect.die("Unexpected create."),
		listProjectsFx: Effect.die("Unexpected list."),
		readProjectFx: () => Effect.die("Unexpected read."),
		replaceConfigFx: () => Effect.die("Unexpected config save."),
		replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
		deleteItemFx: () => Effect.die("Unexpected item delete."),
		upsertItemFx,
		upsertResourcesFx: () => Effect.die("Unexpected resource save."),
	};
	return {
		registry,
		repository,
		upsertItemFx,
	};
};

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("saveEditorItemFx", () => {
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
			saveEditorItemFx({
				projectId: "project",
				item,
			}).pipe(
				Effect.provideService(EditorProjectRepository, fixture.repository),
				Effect.provideService(AtomRegistry.AtomRegistry, fixture.registry),
			),
		);

		expect(saved).toEqual(item);
		expect(fixture.upsertItemFx).toHaveBeenCalledWith({
			projectId: "project",
			item,
		});
		expect(fixture.registry.get(projectAtom)?.revision).toBe(1);
		expect(fixture.registry.get(projectAtom)?.resources).toBe(resources);
	});

	it("rejects an invalid item before repository admission", async () => {
		const fixture = createFixture();
		await expect(
			Effect.runPromise(
				saveEditorItemFx({
					projectId: "project",
					item: {
						...editorTestPayload.config.items.water,
						id: "",
					},
				}).pipe(
					Effect.provideService(EditorProjectRepository, fixture.repository),
					Effect.provideService(AtomRegistry.AtomRegistry, fixture.registry),
				),
			),
		).rejects.toThrow("does not satisfy");
		expect(fixture.upsertItemFx).not.toHaveBeenCalled();
	});
});
