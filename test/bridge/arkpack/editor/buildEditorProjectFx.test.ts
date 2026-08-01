import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { buildEditorProjectFx } from "~/bridge/arkpack/editor/buildEditorProjectFx";
import type { EditorProject } from "~/bridge/editor/EditorProject";
import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/bridge/editor/EditorProjectRepository";
import { readArkpackContentHashFx } from "~/engine/pack/fx/readArkpackContentHashFx";
import { GameValidationError } from "~/engine/validation/error/GameValidationError";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

const createProject = (resources = editorTestPayload.resources): EditorProject => ({
	projectId: "project",
	title: editorTestPayload.config.meta.title,
	game: editorTestPayload.config.version,
	createdAtMs: 1,
	updatedAtMs: 2,
	revision: 7,
	config: editorTestPayload.config,
	resources,
});

const createRepository = (project: EditorProject | null): EditorProjectRepositoryService => ({
	awaitIdleFx: Effect.void,
	createProjectFx: () => Effect.die("Unexpected create."),
	listProjectsFx: Effect.die("Unexpected list."),
	readProjectFx: () => Effect.succeed(project),
	upsertItemFx: () => Effect.die("Unexpected item save."),
	upsertResourceFx: () => Effect.die("Unexpected resource save."),
});

describe("buildEditorProjectFx", () => {
	it("builds immutable bytes from one exact valid repository snapshot", async () => {
		const artifact = await Effect.runPromise(
			buildEditorProjectFx("project").pipe(
				Effect.provideService(EditorProjectRepository, createRepository(createProject())),
			),
		);

		expect(artifact.revision).toBe(7);
		expect(artifact.filename).toBe("editor-test.arkpack");
		expect(artifact.bytes.byteLength).toBeGreaterThan(0);
		expect(artifact.contentHash).toBe(
			await Effect.runPromise(readArkpackContentHashFx(artifact.bytes)),
		);
	});

	it("rejects a semantically incomplete project without emitting bytes", async () => {
		const effect = buildEditorProjectFx("project").pipe(
			Effect.provideService(
				EditorProjectRepository,
				createRepository(
					createProject([
						editorTestPayload.resources[0],
					]),
				),
			),
		);

		await expect(Effect.runPromise(effect)).rejects.toBeInstanceOf(GameValidationError);
	});
});
