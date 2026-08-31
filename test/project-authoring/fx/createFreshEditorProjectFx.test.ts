import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validateArkpackPayloadFx } from "~/arkpack-admission/fx/validateArkpackPayloadFx";
import { createFreshEditorProjectFx } from "~/project-authoring/fx/createFreshEditorProjectFx";
import type { EditorProject } from "~/project-authoring/type/EditorProject";
import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/project-authoring/service/EditorProjectRepository";
import { installTestPngDecoder } from "~test/arkpack/support/createTestPngBytes";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const createRepository = (
	createProjectFx: EditorProjectRepositoryService["createProjectFx"],
): EditorProjectRepositoryService => ({
	...UnusedEditorProjectRepository,
	awaitIdleFx: Effect.void,
	createProjectFx,
	listProjectsFx: Effect.die("Unexpected project list."),
	readProjectFx: () => Effect.die("Unexpected project read."),
	replaceConfigFx: () => Effect.die("Unexpected config save."),
	replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
	deleteItemFx: () => Effect.die("Unexpected item delete."),
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
			({ config, resources }: EditorProjectRepository.CreateProjectProps) =>
				Effect.succeed<EditorProject>({
					projectId: config.meta.id,
					title: config.meta.title,
					version: "1.0",
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
			version: "1.0",
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
		expect(createProjectFx).toHaveBeenCalledWith(
			expect.objectContaining({
				version: "1.0",
			}),
		);
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
