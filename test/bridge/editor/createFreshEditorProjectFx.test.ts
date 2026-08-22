import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validateArkpackPayloadFx } from "~/bridge/arkpack/validateArkpackPayloadFx";
import { createFreshEditorProjectFx } from "~/bridge/editor/createFreshEditorProjectFx";
import type { EditorProject } from "~/bridge/editor/EditorProject";
import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/bridge/editor/EditorProjectRepository";
import { installTestPngDecoder } from "~test/bridge/arkpack/support/createTestPngBytes";

const createRepository = (
	createProjectFx: EditorProjectRepositoryService["createProjectFx"],
): EditorProjectRepositoryService => ({
	awaitIdleFx: Effect.void,
	createProjectFx,
	listProjectsFx: Effect.die("Unexpected project list."),
	readProjectFx: () => Effect.die("Unexpected project read."),
	replaceConfigFx: () => Effect.die("Unexpected config save."),
	replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
	upsertItemFx: () => Effect.die("Unexpected item save."),
	upsertResourcesFx: () => Effect.die("Unexpected resource save."),
});

beforeEach(() => {
	installTestPngDecoder();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("createFreshEditorProjectFx", () => {
	it("atomically creates one schema-valid empty project with a replaceable hero", async () => {
		const createProjectFx = vi.fn(
			({ projectId, config, resources }: EditorProjectRepository.CreateProjectProps) =>
				Effect.succeed<EditorProject>({
					projectId,
					title: config.meta.title,
					game: config.version,
					createdAtMs: 100,
					updatedAtMs: 100,
					revision: 0,
					config,
					resources,
				}),
		);

		const project = await Effect.runPromise(
			createFreshEditorProjectFx().pipe(
				Effect.provideService(EditorProjectRepository, createRepository(createProjectFx)),
			),
		);

		expect(project.projectId).toMatch(/^project-[A-Za-z0-9]+$/);
		expect(project).toMatchObject({
			title: "Untitled project",
			game: "1.0",
			revision: 0,
			config: {
				meta: {
					id: project.projectId,
					board: {
						width: 15,
						height: 9,
					},
					inventory: {
						width: 15,
						height: 9,
					},
					toolbarSize: 15,
				},
				resources: {
					hero: "hero",
				},
				start: {
					currentSpace: 0,
					board: [],
					inventory: [],
					toolbar: [],
				},
				items: {},
			},
		});
		expect(project.resources).toHaveLength(1);
		expect(project.resources[0]).toMatchObject({
			id: "hero",
			mime: "image/png",
		});
		expect(project.resources[0]?.bytes.slice(0, 8)).toEqual(
			Uint8Array.from([
				137,
				80,
				78,
				71,
				13,
				10,
				26,
				10,
			]),
		);
		expect(
			await Effect.runPromise(
				validateArkpackPayloadFx({
					config: project.config,
					resources: [
						...project.resources,
					],
				}),
			),
		).toEqual([]);
		expect(createProjectFx).toHaveBeenCalledOnce();
	});
});
