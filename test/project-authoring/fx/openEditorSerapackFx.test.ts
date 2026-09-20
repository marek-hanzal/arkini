import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { openEditorSerapackFx } from "~/project-authoring/fx/openEditorSerapackFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";
import {
	editorTestPayload,
	editorTestResources,
} from "~test/project-authoring/support/editorTestPayload";

const project = {
	projectId: editorTestPayload.config.meta.id,
	title: editorTestPayload.config.meta.title,
	version: {
		major: 4,
		minor: 2,
	},
	createdAtMs: 100,
	updatedAtMs: 100,
	revision: 0,
	config: editorTestPayload.config,
	resources: editorTestResources,
};

afterEach(() => vi.unstubAllGlobals());

const createRepository = (
	readProjectFx: ProjectRepositoryService["readProjectFx"],
): ProjectRepositoryService => ({
	...UnusedEditorProjectRepository,
	awaitIdleFx: Effect.void,
	createProjectFx: () => Effect.die("Unexpected project create."),
	deleteItemFx: () => Effect.die("Unexpected item delete."),
	listProjectsFx: Effect.die("Unexpected project list."),
	readProjectFx,
	replaceConfigFx: () => Effect.die("Unexpected config replacement."),
	replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
	upsertItemFx: () => Effect.die("Unexpected item upsert."),
});

describe("openEditorSerapackFx", () => {
	it("returns an existing matching Editor project", async () => {
		const repository = createRepository(() => Effect.succeed(project));
		await expect(
			Effect.runPromise(
				openEditorSerapackFx(project.projectId).pipe(
					Effect.provideService(ProjectRepository, repository),
				),
			),
		).resolves.toMatchObject({
			projectId: project.projectId,
		});
	});

	it("asks main to stream-import a missing installed Serapack", async () => {
		vi.stubGlobal("window", {
			serakki: {
				editor: {
					importInstalledSerapackFn: async () => ({
						type: "success",
						value: {
							projectId: project.projectId,
							title: project.title,
							version: project.version,
							createdAtMs: project.createdAtMs,
							updatedAtMs: project.updatedAtMs,
						},
					}),
				},
			},
		});
		const repository = createRepository(() => Effect.succeed(null));
		await expect(
			Effect.runPromise(
				openEditorSerapackFx(project.projectId).pipe(
					Effect.provideService(ProjectRepository, repository),
				),
			),
		).resolves.toMatchObject({
			projectId: project.projectId,
		});
	});
});
