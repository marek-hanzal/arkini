import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildEditorProjectFx } from "~/bridge/arkpack/editor/buildEditorProjectFx";
import type { EditorProject } from "~/bridge/editor/EditorProject";
import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/bridge/editor/EditorProjectRepository";
import { PngResourceLimits } from "~/bridge/resource/validatePngResourceFx";
import { readArkpackContentHashFx } from "~/engine/pack/fx/readArkpackContentHashFx";
import { GameValidationError } from "~/engine/validation/error/GameValidationError";
import {
	createTestPngBytes,
	installTestPngDecoder,
} from "~test/bridge/arkpack/support/createTestPngBytes";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

const validResources = editorTestPayload.resources.map((resource) => ({
	...resource,
	bytes: createTestPngBytes(),
}));

const createProject = (resources = validResources): EditorProject => ({
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
						validResources[0],
					]),
				),
			),
		);

		await expect(Effect.runPromise(effect)).rejects.toBeInstanceOf(GameValidationError);
	});

	it("rejects malformed PNG bytes before producing an artifact", async () => {
		vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error("decode failed"));
		const fakePng = new Uint8Array(24);
		fakePng.set([
			137,
			80,
			78,
			71,
			13,
			10,
			26,
			10,
		]);
		const effect = buildEditorProjectFx("project").pipe(
			Effect.provideService(
				EditorProjectRepository,
				createRepository(
					createProject([
						{
							...validResources[0],
							bytes: fakePng,
						},
						validResources[1],
					]),
				),
			),
		);

		await expect(Effect.runPromise(effect)).rejects.toThrow("must decode as a valid PNG image");
	});

	it("rejects a PNG beyond the byte limit before producing an artifact", async () => {
		const effect = buildEditorProjectFx("project").pipe(
			Effect.provideService(
				EditorProjectRepository,
				createRepository(
					createProject([
						{
							...validResources[0],
							bytes: new Uint8Array(PngResourceLimits.maxBytes + 1),
						},
						validResources[1],
					]),
				),
			),
		);

		await expect(Effect.runPromise(effect)).rejects.toThrow(
			"must be a valid bounded PNG image",
		);
	});
});
