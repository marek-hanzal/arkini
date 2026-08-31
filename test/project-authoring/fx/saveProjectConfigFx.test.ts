import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Project } from "~/project-authoring/type/Project";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import {
	ProjectRepository,
	type ProjectRepositoryService,
} from "~/project-authoring/service/ProjectRepository";
import { saveProjectConfigFx } from "~/project-authoring/fx/saveProjectConfigFx";
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

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("saveProjectConfigFx", () => {
	it("atomically commits and publishes one complete config", async () => {
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const projectAtom = EditorProjectAtom("project");
		registry.mount(projectAtom);
		registry.set(projectAtom, {
			project: createProject(),
		});
		const config = {
			...editorTestPayload.config,
			meta: {
				...editorTestPayload.config.meta,
				title: "Edited project",
			},
		};
		const replaceConfigFx = vi.fn<ProjectRepositoryService["replaceConfigFx"]>(
			({ config: committed }) => {
				const { resources: _resources, ...commit } = createProject(1);
				return Effect.succeed({
					...commit,
					previousRevision: 0,
					title: committed.meta.title,
					config: committed,
				});
			},
		);
		const repository: ProjectRepositoryService = {
			...UnusedEditorProjectRepository,
			awaitIdleFx: Effect.void,
			createProjectFx: () => Effect.die("Unexpected create."),
			listProjectsFx: Effect.die("Unexpected list."),
			readProjectFx: () => Effect.die("Unexpected read."),
			replaceConfigFx,
			replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
			deleteItemFx: () => Effect.die("Unexpected item delete."),
			upsertItemFx: () => Effect.die("Unexpected item save."),
			upsertResourcesFx: () => Effect.die("Unexpected resource save."),
		};

		await expect(
			Effect.runPromise(
				saveProjectConfigFx({
					config,
					expectedRevision: 0,
					projectId: "project",
				}).pipe(
					Effect.provideService(ProjectRepository, repository),
					Effect.provideService(AtomRegistry.AtomRegistry, registry),
				),
			),
		).resolves.toEqual(config);
		expect(replaceConfigFx).toHaveBeenCalledWith({
			config,
			expectedRevision: 0,
			projectId: "project",
		});
		expect(registry.get(projectAtom)?.revision).toBe(1);
		expect(registry.get(projectAtom)?.config.meta.title).toBe("Edited project");
		expect(registry.get(projectAtom)?.resources).toBe(editorTestPayload.resources);
	});

	it("does not publish a fake revision when the repository rejects a stale save", async () => {
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const projectAtom = EditorProjectAtom("project");
		registry.mount(projectAtom);
		registry.set(projectAtom, {
			project: createProject(1),
		});
		const repository: ProjectRepositoryService = {
			...UnusedEditorProjectRepository,
			awaitIdleFx: Effect.void,
			createProjectFx: () => Effect.die("Unexpected create."),
			listProjectsFx: Effect.die("Unexpected list."),
			readProjectFx: () => Effect.die("Unexpected read."),
			replaceConfigFx: () =>
				Effect.fail(
					new ProjectRepositoryError({
						operation: "replace-config",
						message: "stale revision",
					}),
				),
			replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
			deleteItemFx: () => Effect.die("Unexpected item delete."),
			upsertItemFx: () => Effect.die("Unexpected item save."),
			upsertResourcesFx: () => Effect.die("Unexpected resource save."),
		};

		await expect(
			Effect.runPromise(
				saveProjectConfigFx({
					config: {
						...editorTestPayload.config,
						meta: {
							...editorTestPayload.config.meta,
							title: "Stale edit",
						},
					},
					expectedRevision: 0,
					projectId: "project",
				}).pipe(
					Effect.provideService(ProjectRepository, repository),
					Effect.provideService(AtomRegistry.AtomRegistry, registry),
				),
			),
		).rejects.toThrow("stale revision");
		expect(registry.get(projectAtom)?.revision).toBe(1);
		expect(registry.get(projectAtom)?.config.meta.title).toBe(
			editorTestPayload.config.meta.title,
		);
	});

	it("rejects invalid config before repository admission", async () => {
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const replaceConfigFx = vi.fn<ProjectRepositoryService["replaceConfigFx"]>();
		const repository = {
			replaceConfigFx,
		} as unknown as ProjectRepositoryService;
		await expect(
			Effect.runPromise(
				saveProjectConfigFx({
					config: {
						...editorTestPayload.config,
						meta: {
							...editorTestPayload.config.meta,
							title: "",
						},
					},
					expectedRevision: 0,
					projectId: "project",
				}).pipe(
					Effect.provideService(ProjectRepository, repository),
					Effect.provideService(AtomRegistry.AtomRegistry, registry),
				),
			),
		).rejects.toThrow("project configuration is invalid");
		expect(replaceConfigFx).not.toHaveBeenCalled();
	});
});
