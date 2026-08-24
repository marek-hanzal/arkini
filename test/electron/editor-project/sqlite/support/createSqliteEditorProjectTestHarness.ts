import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";

import {
	createSqliteEditorProjectRepositoryFx,
	type SqliteEditorProjectRepository,
} from "../../../../../electron/main/editor-project/sqlite/createSqliteEditorProjectRepositoryFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

/** Owns the temporary database and every repository opened by one SQLite test. */
export const createSqliteEditorProjectTestHarness = async (temporaryPrefix: string) => {
	const temporaryDirectory = await mkdtemp(join(tmpdir(), temporaryPrefix));
	let databasePath = join(temporaryDirectory, "projects.sqlite");
	const openRepositories = new Set<SqliteEditorProjectRepository>();
	const openRepository = async () => {
		const repository = await Effect.runPromise(
			createSqliteEditorProjectRepositoryFx({
				databasePath,
			}),
		);
		openRepositories.add(repository);
		return repository;
	};
	const closeRepository = async (repository: SqliteEditorProjectRepository) => {
		await Effect.runPromise(repository.closeFx);
		openRepositories.delete(repository);
	};
	return {
		temporaryDirectory,
		get databasePath() {
			return databasePath;
		},
		setDatabasePath: (path: string) => {
			databasePath = path;
		},
		openRepository,
		closeRepository,
		createProject: (repository: SqliteEditorProjectRepository, projectId = "project-one") =>
			Effect.runPromise(
				repository.createProjectFx({
					projectId,
					version: "1.0",
					config: editorTestPayload.config,
					resources: editorTestPayload.resources,
				}),
			),
		close: async () => {
			for (const repository of openRepositories) await closeRepository(repository);
			await rm(temporaryDirectory, {
				force: true,
				recursive: true,
			});
		},
	};
};

export type SqliteEditorProjectTestHarness = Awaited<
	ReturnType<typeof createSqliteEditorProjectTestHarness>
>;
