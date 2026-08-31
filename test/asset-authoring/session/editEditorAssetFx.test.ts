import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/project-authoring/service/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/project-authoring/error/EditorProjectRepositoryError";
import { editEditorAssetFx } from "~/asset-authoring/fx/editEditorAssetFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const registries: AtomRegistry.AtomRegistry[] = [];

const createProject = (revision = 3): EditorProject => ({
	projectId: "project",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: revision + 1,
	revision,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
});

const createRepository = (
	replaceResourceFx: EditorProjectRepositoryService["replaceResourceFx"],
	project = createProject(),
): EditorProjectRepositoryService => ({
	...UnusedEditorProjectRepository,
	awaitIdleFx: Effect.void,
	createProjectFx: () => Effect.die("Unexpected create."),
	listProjectsFx: Effect.die("Unexpected list."),
	readProjectFx: () => Effect.succeed(project),
	replaceConfigFx: () => Effect.die("Unexpected config save."),
	replaceResourceFx,
	deleteItemFx: () => Effect.die("Unexpected item delete."),
	upsertItemFx: () => Effect.die("Unexpected item save."),
	upsertResourcesFx: () => Effect.die("Unexpected resource save."),
});

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("editEditorAssetFx", () => {
	it("plans the resource replacement from the canonical repository snapshot", async () => {
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const project = createProject();
		const projectAtom = EditorProjectAtom(project.projectId);
		registry.mount(projectAtom);
		registry.set(projectAtom, {
			project: {
				...project,
				revision: project.revision - 1,
			},
		});
		const replaceResourceFx = vi.fn<EditorProjectRepositoryService["replaceResourceFx"]>(
			({ config, resource }) =>
				Effect.succeed({
					...project,
					title: config.meta.title,
					revision: project.revision + 1,
					updatedAtMs: project.updatedAtMs + 1,
					config,
					resources: project.resources.map((existing) =>
						existing.id === "hero" ? resource : existing,
					),
				}),
		);

		await Effect.runPromise(
			editEditorAssetFx({
				currentId: "hero",
				projectId: project.projectId,
				resourceId: "new-hero",
			}).pipe(
				Effect.provideService(EditorProjectRepository, createRepository(replaceResourceFx)),
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);

		expect(replaceResourceFx).toHaveBeenCalledWith(
			expect.objectContaining({
				currentId: "hero",
				expectedRevision: project.revision,
				projectId: project.projectId,
				resource: expect.objectContaining({
					id: "new-hero",
				}),
			}),
		);
		expect(replaceResourceFx.mock.calls[0]?.[0].config.resources.hero).toBe("new-hero");
		expect(registry.get(projectAtom)?.revision).toBe(project.revision + 1);
	});

	it("does not publish replacement state after a stale revision rejection", async () => {
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const project = createProject();
		const projectAtom = EditorProjectAtom(project.projectId);
		registry.mount(projectAtom);
		registry.set(projectAtom, {
			project,
		});
		const replaceResourceFx: EditorProjectRepositoryService["replaceResourceFx"] = () =>
			Effect.fail(
				new EditorProjectRepositoryError({
					operation: "replace-resource",
					message: "stale revision",
				}),
			);

		await expect(
			Effect.runPromise(
				editEditorAssetFx({
					currentId: "hero",
					projectId: project.projectId,
					resourceId: "new-hero",
				}).pipe(
					Effect.provideService(
						EditorProjectRepository,
						createRepository(replaceResourceFx),
					),
					Effect.provideService(AtomRegistry.AtomRegistry, registry),
				),
			),
		).rejects.toThrow("stale revision");
		expect(registry.get(projectAtom)?.revision).toBe(project.revision);
		expect(registry.get(projectAtom)?.config.resources.hero).toBe("hero");
	});
});
