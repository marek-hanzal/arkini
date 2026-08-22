import { gzipSync } from "node:zlib";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { importEditorArkpackFileFx } from "~/bridge/arkpack/editor/importEditorArkpackFileFx";
import type { EditorProject } from "~/bridge/editor/EditorProject";
import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/bridge/editor/EditorProjectRepository";
import { encodeFx } from "~/engine/pack/fx/encodeFx";
import type { PayloadSchema } from "~/engine/pack/schema/PayloadSchema";
import {
	createTestPngBytes,
	installTestPngDecoder,
} from "~test/bridge/arkpack/support/createTestPngBytes";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

const validPayload: PayloadSchema.Type = {
	config: editorTestPayload.config,
	resources: editorTestPayload.resources.map((resource) => ({
		...resource,
		bytes: createTestPngBytes(),
	})),
};

const createArkpackBytes = (payload = validPayload) =>
	new Uint8Array(gzipSync(Effect.runSync(encodeFx(payload))));

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

const runImport = (
	props: Parameters<typeof importEditorArkpackFileFx>[0],
	repository: EditorProjectRepositoryService,
) =>
	Effect.runPromise(
		importEditorArkpackFileFx(props).pipe(
			Effect.provideService(EditorProjectRepository, repository),
		),
	);

beforeEach(() => {
	installTestPngDecoder();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("importEditorArkpackFileFx", () => {
	it("validates an arkpack and atomically delegates its canonical payload", async () => {
		const bytes = createArkpackBytes();
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

		const descriptor = await runImport(
			{
				file: {
					name: "editor-test.arkpack",
					size: bytes.byteLength,
					arrayBuffer: async () => bytes.slice().buffer,
				},
			},
			createRepository(createProjectFx),
		);

		expect(descriptor).toMatchObject({
			projectId: "editor-test",
			title: "Editor test",
			game: "1.0",
			revision: 0,
		});
		expect(createProjectFx).toHaveBeenCalledOnce();
		expect(createProjectFx).toHaveBeenCalledWith({
			projectId: "editor-test",
			config: editorTestPayload.config,
			resources: validPayload.resources,
		});
	});

	it("rejects malformed PNG bytes before creating a project", async () => {
		const bytes = createArkpackBytes({
			...validPayload,
			resources: [
				{
					...validPayload.resources[0],
					bytes: new Uint8Array([
						1,
						2,
						3,
						4,
					]),
				},
				validPayload.resources[1],
			],
		});
		const createProjectFx = vi.fn(() => Effect.die("Unexpected project create."));

		await expect(
			runImport(
				{
					file: {
						name: "invalid.arkpack",
						size: bytes.byteLength,
						arrayBuffer: async () => bytes.slice().buffer,
					},
				},
				createRepository(createProjectFx),
			),
		).rejects.toThrow("must be a valid bounded PNG image");
		expect(createProjectFx).not.toHaveBeenCalled();
	});

	it("rejects dropped files without the arkpack extension before reading bytes", async () => {
		const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
		const createProjectFx = vi.fn(() => Effect.die("Unexpected project create."));

		await expect(
			runImport(
				{
					file: {
						name: "editor-test.zip",
						size: 0,
						arrayBuffer,
					},
				},
				createRepository(createProjectFx),
			),
		).rejects.toThrow("Choose a .arkpack file");
		expect(arrayBuffer).not.toHaveBeenCalled();
		expect(createProjectFx).not.toHaveBeenCalled();
	});
});
