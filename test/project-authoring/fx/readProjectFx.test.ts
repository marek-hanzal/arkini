import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { Project } from "~/project-authoring/type/Project";
import {
	ProjectRepository,
	type ProjectRepositoryService,
} from "~/project-authoring/service/ProjectRepository";
import { readProjectFx as readCanonicalProjectFx } from "~/project-authoring/fx/readProjectFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const project: Project = {
	projectId: "editor-test",
	title: "Editor test",
	version: "1.0",
	createdAtMs: 123,
	updatedAtMs: 124,
	revision: 2,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
};

const createRepository = (
	readProjectFx: ProjectRepositoryService["readProjectFx"],
): ProjectRepositoryService => ({
	...UnusedEditorProjectRepository,
	awaitIdleFx: Effect.void,
	createProjectFx: () => Effect.die("Unexpected project create."),
	listProjectsFx: Effect.die("Unexpected project list."),
	readProjectFx,
	replaceConfigFx: () => Effect.die("Unexpected config save."),
	replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
	deleteItemFx: () => Effect.die("Unexpected item delete."),
	upsertItemFx: () => Effect.die("Unexpected item save."),
	upsertResourcesFx: () => Effect.die("Unexpected resource save."),
});

const runWithRepository = <Value, Error>(
	effect: Effect.Effect<Value, Error, ProjectRepository>,
	repository: ProjectRepositoryService,
) => Effect.runPromise(effect.pipe(Effect.provideService(ProjectRepository, repository)));

describe("readProjectFx", () => {
	it("returns the exact canonical repository project", async () => {
		const readProjectFx = vi.fn(() => Effect.succeed(project));

		await expect(
			runWithRepository(
				readCanonicalProjectFx({
					projectId: project.projectId,
				}),
				createRepository(readProjectFx),
			),
		).resolves.toBe(project);
		expect(readProjectFx).toHaveBeenCalledWith(project.projectId);
	});

	it("fails when the requested repository project does not exist", async () => {
		await expect(
			runWithRepository(
				readCanonicalProjectFx({
					projectId: "missing",
				}),
				createRepository(() => Effect.succeed(null)),
			),
		).rejects.toThrow("Editor project missing does not exist");
	});
});
