import type { DatabaseSync, StatementSync } from "node:sqlite";
import { Clock, Effect, type Semaphore } from "effect";

import type { EditorProjectRecordSchema } from "~/editor/EditorProjectRecordSchema";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/editor/EditorProjectRepositoryError";
import {
	EditorBoardScenarioNameSchema,
	EditorBoardScenarioSchema,
} from "~/editor/board/EditorBoardScenarioSchema";
import { runSqliteEditorProjectTransactionFx } from "./runSqliteEditorProjectTransactionFx";
import { SqliteEditorBoardScenarioDescriptorRowSchema } from "../schema/SqliteEditorBoardScenarioDescriptorRowSchema";
import { SqliteEditorBoardScenarioRowSchema } from "../schema/SqliteEditorBoardScenarioRowSchema";
import { SqliteEditorProjectRowSchema } from "../schema/SqliteEditorProjectRowSchema";

type BoardScenarioOperations = Pick<
	EditorProjectRepositoryService,
	| "listBoardScenariosFx"
	| "readBoardScenarioFx"
	| "writeBoardScenarioFx"
	| "deleteBoardScenarioFx"
>;

const createRepositoryError = (
	operation: EditorProjectRepositoryOperation,
	message: string,
	cause?: unknown,
) =>
	cause instanceof EditorProjectRepositoryError
		? cause
		: new EditorProjectRepositoryError({
				operation,
				message,
				cause,
			});

const readProjectRow = (
	statement: StatementSync,
	projectId: string,
	operation: EditorProjectRepositoryOperation,
) => {
	const candidate = statement.get(projectId);
	if (candidate === undefined) return null;
	const result = SqliteEditorProjectRowSchema.safeParse(candidate);
	if (result.success) return result.data;
	throw createRepositoryError(
		operation,
		"SQLite contains an invalid editor project record.",
		result.error,
	);
};

const readBoardScenarioRow = (
	candidate: Record<string, unknown> | undefined,
	operation: EditorProjectRepositoryOperation,
) => {
	if (candidate === undefined) return null;
	const result = SqliteEditorBoardScenarioRowSchema.safeParse(candidate);
	if (result.success) return result.data;
	throw createRepositoryError(
		operation,
		"SQLite contains an invalid editor Board scenario.",
		result.error,
	);
};

const assertExpectedRevision = (
	record: EditorProjectRecordSchema.Type,
	expectedRevision: number,
	operation: EditorProjectRepositoryOperation,
) => {
	if (record.revision === expectedRevision) return;
	throw createRepositoryError(
		operation,
		`Editor project ${record.projectId} changed from revision ${expectedRevision} to ${record.revision} before this write could commit.`,
	);
};

export namespace createSqliteEditorBoardScenarioOperationsFx {
	export interface Props {
		readonly database: DatabaseSync;
		readonly writeLock: Semaphore.Semaphore;
	}
}

/** Creates revision-pinned Board scenario operations over one SQLite authority. */
export const createSqliteEditorBoardScenarioOperationsFx = Effect.fn(
	"createSqliteEditorBoardScenarioOperationsFx",
)(function* ({ database, writeLock }: createSqliteEditorBoardScenarioOperationsFx.Props) {
	const {
		selectProject,
		selectBoardScenarios,
		selectBoardScenario,
		upsertBoardScenario,
		deleteBoardScenario,
	} = yield* Effect.try({
		try: () => ({
			selectProject: database.prepare(`
				SELECT project_id, config_json, arkpack_version, revision, created_at_ms, updated_at_ms
				FROM projects
				WHERE project_id = ?
			`),
			selectBoardScenarios: database.prepare(`
				SELECT project_id, name, project_revision, arkpack_version, created_at_ms, updated_at_ms
				FROM board_scenarios
				WHERE project_id = ?
				ORDER BY updated_at_ms DESC, name ASC
			`),
			selectBoardScenario: database.prepare(`
				SELECT project_id, name, project_revision, arkpack_version, save_bytes, created_at_ms, updated_at_ms
				FROM board_scenarios
				WHERE project_id = ? AND name = ?
			`),
			upsertBoardScenario: database.prepare(`
				INSERT INTO board_scenarios(
					project_id, name, project_revision, arkpack_version, save_bytes, created_at_ms, updated_at_ms
				) VALUES (?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(project_id, name) DO UPDATE SET
					project_revision = excluded.project_revision,
					arkpack_version = excluded.arkpack_version,
					save_bytes = excluded.save_bytes,
					updated_at_ms = excluded.updated_at_ms
			`),
			deleteBoardScenario: database.prepare(
				"DELETE FROM board_scenarios WHERE project_id = ? AND name = ?",
			),
		}),
		catch: (cause) =>
			createRepositoryError(
				"list-board-scenarios",
				"The editor Board scenario schema is incompatible.",
				cause,
			),
	});

	const listBoardScenariosFx: BoardScenarioOperations["listBoardScenariosFx"] = Effect.fn(
		"SqliteEditorProjectRepository.listBoardScenariosFx",
	)((projectId) =>
		Effect.try({
			try: () => {
				if (readProjectRow(selectProject, projectId, "list-board-scenarios") === null)
					throw createRepositoryError(
						"list-board-scenarios",
						`Editor project ${projectId} does not exist.`,
					);
				return selectBoardScenarios.all(projectId).map((candidate) => {
					const result =
						SqliteEditorBoardScenarioDescriptorRowSchema.safeParse(candidate);
					if (result.success) return result.data;
					throw createRepositoryError(
						"list-board-scenarios",
						"SQLite contains invalid editor Board scenario metadata.",
						result.error,
					);
				});
			},
			catch: (cause) =>
				createRepositoryError(
					"list-board-scenarios",
					`Board scenarios for project ${projectId} could not be listed.`,
					cause,
				),
		}),
	);

	const readBoardScenarioFx: BoardScenarioOperations["readBoardScenarioFx"] = Effect.fn(
		"SqliteEditorProjectRepository.readBoardScenarioFx",
	)(({ projectId, name }) =>
		Effect.try({
			try: () =>
				readBoardScenarioRow(
					selectBoardScenario.get(projectId, name),
					"read-board-scenario",
				),
			catch: (cause) =>
				createRepositoryError(
					"read-board-scenario",
					`Board scenario ${name} in project ${projectId} could not be read.`,
					cause,
				),
		}),
	);

	const writeBoardScenarioFx: BoardScenarioOperations["writeBoardScenarioFx"] = Effect.fn(
		"SqliteEditorProjectRepository.writeBoardScenarioFx",
	)(function* ({ projectId, expectedRevision, name: candidateName, bytes: candidateBytes }) {
		const { name, bytes } = yield* Effect.try({
			try: () => ({
				name: EditorBoardScenarioNameSchema.parse(candidateName),
				bytes: new Uint8Array(candidateBytes),
			}),
			catch: (cause) =>
				createRepositoryError(
					"write-board-scenario",
					"The editor Board scenario is invalid.",
					cause,
				),
		});
		if (bytes.byteLength === 0)
			return yield* Effect.fail(
				createRepositoryError(
					"write-board-scenario",
					"The editor Board scenario is empty.",
				),
			);
		const nowMs = yield* Clock.currentTimeMillis;
		return yield* writeLock.withPermits(1)(
			runSqliteEditorProjectTransactionFx(database, () => {
				const current = readProjectRow(selectProject, projectId, "write-board-scenario");
				if (current === null)
					throw createRepositoryError(
						"write-board-scenario",
						`Editor project ${projectId} does not exist.`,
					);
				assertExpectedRevision(current, expectedRevision, "write-board-scenario");
				const previous = readBoardScenarioRow(
					selectBoardScenario.get(projectId, name),
					"write-board-scenario",
				);
				const written = EditorBoardScenarioSchema.parse({
					projectId,
					name,
					projectRevision: current.revision,
					version: current.version,
					bytes,
					createdAtMs: previous?.createdAtMs ?? nowMs,
					updatedAtMs: Math.max(nowMs, (previous?.updatedAtMs ?? nowMs - 1) + 1),
				});
				upsertBoardScenario.run(
					written.projectId,
					written.name,
					written.projectRevision,
					written.version,
					written.bytes,
					written.createdAtMs,
					written.updatedAtMs,
				);
				return written;
			}).pipe(
				Effect.mapError((cause) =>
					createRepositoryError(
						"write-board-scenario",
						`Board scenario ${name} could not be saved in project ${projectId}.`,
						cause,
					),
				),
				Effect.uninterruptible,
			),
		);
	});

	const deleteBoardScenarioFx: BoardScenarioOperations["deleteBoardScenarioFx"] = Effect.fn(
		"SqliteEditorProjectRepository.deleteBoardScenarioFx",
	)(({ projectId, name }) =>
		writeLock.withPermits(1)(
			Effect.try({
				try: () => deleteBoardScenario.run(projectId, name),
				catch: (cause) =>
					createRepositoryError(
						"delete-board-scenario",
						`Board scenario ${name} could not be deleted from project ${projectId}.`,
						cause,
					),
			}).pipe(Effect.asVoid, Effect.uninterruptible),
		),
	);

	return {
		listBoardScenariosFx,
		readBoardScenarioFx,
		writeBoardScenarioFx,
		deleteBoardScenarioFx,
	} satisfies BoardScenarioOperations;
});
