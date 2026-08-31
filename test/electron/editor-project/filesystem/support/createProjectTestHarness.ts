import * as NodeServices from "@effect/platform-node/NodeServices";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, FileSystem } from "effect";

import { ArkiniAppVersion } from "../../../../../shared/ArkiniAppMetadata";
import type { OwnedEditorProjectRepository } from "../../../../../electron/main/editor-project/EditorProjectServiceOwnership";
import { createFilesystemEditorProjectRepositoryFx } from "../../../../../electron/main/editor-project/filesystem/fx/createFilesystemEditorProjectRepositoryFx";
import { writeProjectFilesFx } from "../../../../../electron/main/editor-project/filesystem/fx/writeProjectFilesFx";
import { GameProjectManifestSchema } from "~/game-config/source/schema/GameProjectManifestSchema";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

/** Owns one temporary user-data catalog, its managed roots, and external test folders. */
export const createProjectTestHarness = async (temporaryPrefix: string) => {
	const temporaryDirectory = await mkdtemp(join(tmpdir(), temporaryPrefix));
	const catalogPath = join(temporaryDirectory, "user-data", "projects.json");
	const projectsRoot = join(temporaryDirectory, "user-data", "projects");
	const openRepositories = new Set<OwnedEditorProjectRepository>();
	let externalSequence = 0;

	const openRepository = async (fileSystem?: FileSystem.FileSystem) => {
		const repository = await Effect.runPromise(
			createFilesystemEditorProjectRepositoryFx({
				catalogPath,
				...(fileSystem === undefined
					? {}
					: {
							fileSystem,
						}),
				projectsRoot,
			}),
		);
		openRepositories.add(repository);
		return repository;
	};
	const closeRepository = async (repository: OwnedEditorProjectRepository) => {
		await Effect.runPromise(repository.closeFx);
		openRepositories.delete(repository);
	};

	return {
		temporaryDirectory,
		catalogPath,
		projectsRoot,
		openRepository,
		closeRepository,
		createProject: (repository: OwnedEditorProjectRepository, projectId = "project-one") =>
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
				writeProjectFilesFx({
					root,
					next: {
						arkpack: editorTestPayload.version,
						marker: GameProjectManifestSchema.parse({
							arkini: ArkiniAppVersion,
							revision: 1,
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

export type ProjectTestHarness = Awaited<ReturnType<typeof createProjectTestHarness>>;
