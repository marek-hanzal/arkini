import * as NodeServices from "@effect/platform-node/NodeServices";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";

import { ArkiniAppVersion } from "../../../../../shared/ArkiniAppMetadata";
import {
	createFilesystemEditorProjectRepositoryFx,
	type FilesystemEditorProjectRepository,
} from "../../../../../electron/main/editor-project/filesystem/fx/createFilesystemEditorProjectRepositoryFx";
import { writeFilesystemEditorProjectFilesFx } from "../../../../../electron/main/editor-project/filesystem/fx/writeFilesystemEditorProjectFilesFx";
import { GameProjectManifestSchema } from "~/engine/source/schema/GameProjectManifestSchema";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

/** Owns one temporary user-data catalog, its managed roots, and external test folders. */
export const createFilesystemEditorProjectTestHarness = async (temporaryPrefix: string) => {
	const temporaryDirectory = await mkdtemp(join(tmpdir(), temporaryPrefix));
	const catalogPath = join(temporaryDirectory, "user-data", "projects.json");
	const projectsRoot = join(temporaryDirectory, "user-data", "projects");
	const openRepositories = new Set<FilesystemEditorProjectRepository>();
	let externalSequence = 0;

	const openRepository = async () => {
		const repository = await Effect.runPromise(
			createFilesystemEditorProjectRepositoryFx({
				catalogPath,
				projectsRoot,
			}),
		);
		openRepositories.add(repository);
		return repository;
	};
	const closeRepository = async (repository: FilesystemEditorProjectRepository) => {
		await Effect.runPromise(repository.closeFx);
		openRepositories.delete(repository);
	};

	return {
		temporaryDirectory,
		catalogPath,
		projectsRoot,
		openRepository,
		closeRepository,
		createProject: (repository: FilesystemEditorProjectRepository, projectId = "project-one") =>
			Effect.runPromise(
				repository.createProjectFx({
					version: editorTestPayload.version,
					config: {
						...editorTestPayload.config,
						meta: {
							...editorTestPayload.config.meta,
							id: projectId,
						},
					},
					resources: editorTestPayload.resources,
				}),
			),
		createExternalProject: async (projectId = editorTestPayload.config.meta.id) => {
			externalSequence += 1;
			const root = join(temporaryDirectory, `external-${externalSequence}`);
			await Effect.runPromise(
				writeFilesystemEditorProjectFilesFx({
					root,
					next: {
						arkpack: editorTestPayload.version,
						marker: GameProjectManifestSchema.parse({
							arkini: ArkiniAppVersion,
							updatedAtMs: 1,
						}),
						config: {
							...editorTestPayload.config,
							meta: {
								...editorTestPayload.config.meta,
								id: projectId,
							},
						},
						resources: editorTestPayload.resources,
					},
				}).pipe(Effect.provide(NodeServices.layer)),
			);
			return root;
		},
		close: async () => {
			for (const repository of openRepositories) await closeRepository(repository);
			await rm(temporaryDirectory, {
				force: true,
				recursive: true,
			});
		},
	};
};

export type FilesystemEditorProjectTestHarness = Awaited<
	ReturnType<typeof createFilesystemEditorProjectTestHarness>
>;
