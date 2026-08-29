import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/editor/EditorProject";
import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/editor/EditorProjectRepository";
import { readEditorProjectFx } from "~/project-authoring/readEditorProjectFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const project: EditorProject = {
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
	readProjectFx: EditorProjectRepositoryService["readProjectFx"],
): EditorProjectRepositoryService => ({
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
	effect: Effect.Effect<Value, Error, EditorProjectRepository>,
	repository: EditorProjectRepositoryService,
) => Effect.runPromise(effect.pipe(Effect.provideService(EditorProjectRepository, repository)));

describe("readEditorProjectFx", () => {
	it("returns the exact canonical repository project", async () => {
		const readProjectFx = vi.fn(() => Effect.succeed(project));

		await expect(
			runWithRepository(
				readEditorProjectFx({
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
				readEditorProjectFx({
					projectId: "missing",
				}),
				createRepository(() => Effect.succeed(null)),
			),
		).rejects.toThrow("Editor project missing does not exist");
	});
});
