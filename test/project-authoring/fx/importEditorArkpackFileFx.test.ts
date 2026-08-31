import { gzipSync } from "node:zlib";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { importEditorArkpackFileFx } from "~/project-authoring/fx/importEditorArkpackFileFx";
import type { Project } from "~/project-authoring/type/Project";
import {
	ProjectRepository,
	type ProjectRepositoryService,
} from "~/project-authoring/service/ProjectRepository";
import { encodeFx } from "~/arkpack-artifact/fx/encodeFx";
import { encodeArkpackEnvelopeFx } from "~/arkpack-artifact/fx/encodeArkpackEnvelopeFx";
import type { PayloadSchema } from "~/arkpack-artifact/schema/PayloadSchema";
import {
	createTestPngBytes,
	installTestPngDecoder,
} from "~test/arkpack-support/fn/createTestPngBytes";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";
import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";

const validPayload: PayloadSchema.Type = {
	version: "4.2",
	arkini: ArkiniAppVersion,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources.map((resource) => ({
		...resource,
		bytes: createTestPngBytes(),
	})),
};

const createArkpackBytes = (payload = validPayload) =>
	Effect.runSync(
		encodeArkpackEnvelopeFx({
			payload: new Uint8Array(gzipSync(Effect.runSync(encodeFx(payload)))),
		}),
	);

const createRepository = (
	createProjectFx: ProjectRepositoryService["createProjectFx"],
): ProjectRepositoryService => ({
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

const runImport = (
	props: Parameters<typeof importEditorArkpackFileFx>[0],
	repository: ProjectRepositoryService,
) =>
	Effect.runPromise(
		importEditorArkpackFileFx(props).pipe(Effect.provideService(ProjectRepository, repository)),
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
			({ version, config, resources }: ProjectRepository.CreateProjectProps) =>
				Effect.succeed<Project>({
					projectId: config.meta.id,
					title: config.meta.title,
					version,
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
			projectId: editorTestPayload.config.meta.id,
			title: "Editor test",
			version: "4.2",
			revision: 0,
		});
		expect(createProjectFx).toHaveBeenCalledOnce();
		expect(createProjectFx).toHaveBeenCalledWith({
			version: "4.2",
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
