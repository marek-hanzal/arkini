import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { importEditorAssetsFx } from "~/asset-authoring/fx/importEditorAssetsFx";
import type { Project } from "~/project-authoring/type/Project";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import {
	ProjectRepository,
	type ProjectRepositoryService,
} from "~/project-authoring/service/ProjectRepository";
import { createTestArkpack } from "~test/arkpack-support/fx/createTestArkpack";
import { installTestPngDecoder } from "~test/arkpack-support/fn/createTestPngBytes";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const registries: Array<AtomRegistry.AtomRegistry> = [];

const createProject = (resources: Project["resources"], revision = 1): Project => ({
	projectId: "target-project",
	title: editorTestPayload.config.meta.title,
	version: "1.1",
	createdAtMs: 1,
	updatedAtMs: 2,
	revision,
	config: editorTestPayload.config,
	resources,
});

beforeEach(() => {
	installTestPngDecoder();
});

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
	vi.unstubAllGlobals();
});

describe("Asset Authoring importEditorAssetsFx from Arkpack", () => {
	it("upserts only the validated source resources into the current project", async () => {
		const bytes = createTestArkpack();
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const upsertResourcesFx = vi.fn<ProjectRepositoryService["upsertResourcesFx"]>(
			({ resources }) => Effect.succeed(createProject(resources)),
		);
		const repository: ProjectRepositoryService = {
			...UnusedEditorProjectRepository,
			awaitIdleFx: Effect.void,
			createProjectFx: () => Effect.die("Unexpected project create."),
			listProjectsFx: Effect.die("Unexpected project list."),
			readProjectFx: () => Effect.die("Unexpected project read."),
			replaceConfigFx: () => Effect.die("Unexpected config save."),
			replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
			deleteItemFx: () => Effect.die("Unexpected item delete."),
			upsertItemFx: () => Effect.die("Unexpected item save."),
			upsertResourcesFx,
		};

		const imported = await Effect.runPromise(
			importEditorAssetsFx({
				file: {
					name: "source.arkpack",
					size: bytes.byteLength,
					arrayBuffer: async () => bytes.slice().buffer,
				},
				projectId: "target-project",
				source: "arkpack",
			}).pipe(
				Effect.provideService(ProjectRepository, repository),
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);

		expect(upsertResourcesFx).toHaveBeenCalledOnce();
		expect(upsertResourcesFx).toHaveBeenCalledWith({
			projectId: "target-project",
			resources: expect.arrayContaining([
				expect.objectContaining({
					id: "hero",
				}),
				expect.objectContaining({
					id: "asset:water",
				}),
			]),
		});
		expect(imported.resourceIds).toEqual([
			"hero",
			"asset:water",
		]);
		expect(imported.project.config).toBe(editorTestPayload.config);
		expect(registry.get(EditorProjectAtom("target-project"))?.revision).toBe(1);
	});
});
