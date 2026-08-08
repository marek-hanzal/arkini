import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/bridge/editor/EditorProjectRepository";
import { saveEditorProjectConfigFx } from "~/bridge/project/editor/saveEditorProjectConfigFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

const registries: AtomRegistry.AtomRegistry[] = [];

const createProject = (revision = 0): EditorProject => ({
	projectId: "project",
	title: editorTestPayload.config.meta.title,
	game: editorTestPayload.config.version,
	createdAtMs: 1,
	updatedAtMs: revision + 1,
	revision,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
});

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("saveEditorProjectConfigFx", () => {
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
		const replaceConfigFx = vi.fn<EditorProjectRepositoryService["replaceConfigFx"]>(
			({ config: committed }) => {
				const { resources: _resources, ...commit } = createProject(1);
				return Effect.succeed({
					...commit,
					title: committed.meta.title,
					config: committed,
				});
			},
		);
		const repository: EditorProjectRepositoryService = {
			awaitIdleFx: Effect.void,
			createProjectFx: () => Effect.die("Unexpected create."),
			listProjectsFx: Effect.die("Unexpected list."),
			readProjectFx: () => Effect.die("Unexpected read."),
			replaceConfigFx,
			replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
			upsertItemFx: () => Effect.die("Unexpected item save."),
			upsertResourcesFx: () => Effect.die("Unexpected resource save."),
		};

		await expect(
			Effect.runPromise(
				saveEditorProjectConfigFx({
					config,
					projectId: "project",
				}).pipe(
					Effect.provideService(EditorProjectRepository, repository),
					Effect.provideService(AtomRegistry.AtomRegistry, registry),
				),
			),
		).resolves.toEqual(config);
		expect(replaceConfigFx).toHaveBeenCalledWith({
			config,
			projectId: "project",
		});
		expect(registry.get(projectAtom)?.revision).toBe(1);
		expect(registry.get(projectAtom)?.config.meta.title).toBe("Edited project");
		expect(registry.get(projectAtom)?.resources).toBe(editorTestPayload.resources);
	});

	it("rejects invalid config before repository admission", async () => {
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const replaceConfigFx = vi.fn<EditorProjectRepositoryService["replaceConfigFx"]>();
		const repository = {
			replaceConfigFx,
		} as unknown as EditorProjectRepositoryService;
		await expect(
			Effect.runPromise(
				saveEditorProjectConfigFx({
					config: {
						...editorTestPayload.config,
						meta: {
							...editorTestPayload.config.meta,
							title: "",
						},
					},
					projectId: "project",
				}).pipe(
					Effect.provideService(EditorProjectRepository, repository),
					Effect.provideService(AtomRegistry.AtomRegistry, registry),
				),
			),
		).rejects.toThrow("project configuration is invalid");
		expect(replaceConfigFx).not.toHaveBeenCalled();
	});
});
