import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { importEditorArkpackAssetsFx } from "~/bridge/arkpack/editor/importEditorArkpackAssetsFx";
import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/bridge/editor/EditorProjectRepository";
import { createTestArkpack } from "~test/bridge/arkpack/support/createTestArkpack";
import { installTestPngDecoder } from "~test/bridge/arkpack/support/createTestPngBytes";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const registries: Array<AtomRegistry.AtomRegistry> = [];

const createProject = (resources: EditorProject["resources"], revision = 1): EditorProject => ({
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

describe("importEditorArkpackAssetsFx", () => {
	it("upserts only the validated source resources into the current project", async () => {
		const bytes = createTestArkpack();
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const upsertResourcesFx = vi.fn<EditorProjectRepositoryService["upsertResourcesFx"]>(
			({ resources }) => Effect.succeed(createProject(resources)),
		);
		const repository: EditorProjectRepositoryService = {
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
			importEditorArkpackAssetsFx({
				file: {
					name: "source.arkpack",
					size: bytes.byteLength,
					arrayBuffer: async () => bytes.slice().buffer,
				},
				projectId: "target-project",
			}).pipe(
				Effect.provideService(EditorProjectRepository, repository),
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
