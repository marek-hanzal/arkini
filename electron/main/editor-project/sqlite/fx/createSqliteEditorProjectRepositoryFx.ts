import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Effect, Semaphore } from "effect";

import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { createSqliteEditorBoardScenarioOperationsFx } from "./createSqliteEditorBoardScenarioOperationsFx";
import { createSqliteEditorProjectCommitOperationsFx } from "./createSqliteEditorProjectCommitOperationsFx";
import { createSqliteEditorProjectOperationsFx } from "./createSqliteEditorProjectOperationsFx";
import { initializeSqliteEditorProjectSchemaFx } from "./initializeSqliteEditorProjectSchemaFx";

export interface SqliteEditorProjectRepository extends EditorProjectRepositoryService {
	readonly closeFx: Effect.Effect<void>;
}

export namespace createSqliteEditorProjectRepositoryFx {
	export interface Props {
		readonly databasePath: string;
	}
}

/** Opens and composes the one main-process SQLite authority over canonical editor projects. */
export const createSqliteEditorProjectRepositoryFx = Effect.fn(
	"createSqliteEditorProjectRepositoryFx",
)(function* ({ databasePath }: createSqliteEditorProjectRepositoryFx.Props) {
	const database = yield* Effect.try({
		try: () => {
			if (databasePath !== ":memory:")
				mkdirSync(dirname(databasePath), {
					recursive: true,
				});
			return new DatabaseSync(databasePath, {
				timeout: 5_000,
			});
		},
		catch: (cause) =>
			new EditorProjectRepositoryError({
				operation: "list-projects",
				message: "The editor project database could not be opened.",
				cause,
			}),
	});
	let closed = false;
	const closeDatabaseFx = Effect.sync(() => {
		if (closed) return;
		closed = true;
		database.close();
	});

	yield* initializeSqliteEditorProjectSchemaFx(database).pipe(
		Effect.tapError(() => closeDatabaseFx),
	);
	const writeLock = yield* Semaphore.make(1);
	const projects = yield* createSqliteEditorProjectOperationsFx({
		database,
		writeLock,
	}).pipe(Effect.tapError(() => closeDatabaseFx));
	const commits = yield* createSqliteEditorProjectCommitOperationsFx({
		database,
		writeLock,
	}).pipe(Effect.tapError(() => closeDatabaseFx));
	const boardScenarios = yield* createSqliteEditorBoardScenarioOperationsFx({
		database,
		writeLock,
	}).pipe(Effect.tapError(() => closeDatabaseFx));

	return {
		awaitIdleFx: writeLock.withPermits(1)(Effect.void),
		...projects,
		...commits,
		...boardScenarios,
		closeFx: writeLock.withPermits(1)(closeDatabaseFx),
	} satisfies SqliteEditorProjectRepository;
});
