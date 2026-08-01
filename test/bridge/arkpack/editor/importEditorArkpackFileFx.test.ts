import { gzipSync } from "node:zlib";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { importEditorArkpackFileFx } from "~/bridge/arkpack/editor/importEditorArkpackFileFx";
import type { EditorProject } from "~/bridge/editor/EditorProject";
import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/bridge/editor/EditorProjectRepository";
import { encodeFx } from "~/engine/pack/fx/encodeFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

const createArkpackBytes = () =>
	new Uint8Array(gzipSync(Effect.runSync(encodeFx(editorTestPayload))));

const createRepository = (
	createProjectFx: EditorProjectRepositoryService["createProjectFx"],
): EditorProjectRepositoryService => ({
	awaitIdleFx: Effect.void,
	createProjectFx,
	listProjectsFx: Effect.die("Unexpected project list."),
	readProjectFx: () => Effect.die("Unexpected project read."),
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
			resources: editorTestPayload.resources,
		});
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
