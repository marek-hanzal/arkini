import { randomUUID } from "node:crypto";
import type { DatabaseSync, StatementSync } from "node:sqlite";
import { Clock, Effect, type Semaphore } from "effect";

import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/editor/EditorProjectRepositoryError";
import { EditorNoteContentSchema, EditorNoteSchema } from "~/editor/note/EditorNoteSchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { runSqliteEditorProjectTransactionFx } from "./runSqliteEditorProjectTransactionFx";
import { SqliteEditorNoteRowSchema } from "../schema/SqliteEditorNoteRowSchema";

type NoteOperations = Pick<
	EditorProjectRepositoryService,
	"listNotesFx" | "createNoteFx" | "updateNoteFx" | "deleteNoteFx"
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

const readNoteRow = (
	statement: StatementSync,
	projectId: string,
	noteId: string,
	operation: EditorProjectRepositoryOperation,
) => {
	const candidate = statement.get(projectId, noteId);
	if (candidate === undefined) return null;
	const result = SqliteEditorNoteRowSchema.safeParse(candidate);
	if (result.success) return result.data;
	throw createRepositoryError(
		operation,
		"SQLite contains an invalid editor project note.",
		result.error,
	);
};

export namespace createSqliteEditorNoteOperationsFx {
	export interface Props {
		readonly database: DatabaseSync;
		readonly writeLock: Semaphore.Semaphore;
	}
}

/** Creates project-scoped note operations over the canonical editor SQLite authority. */
export const createSqliteEditorNoteOperationsFx = Effect.fn("createSqliteEditorNoteOperationsFx")(
	function* ({ database, writeLock }: createSqliteEditorNoteOperationsFx.Props) {
		const {
			deleteNote,
			insertNote,
			selectLatestUpdatedAt,
			selectNote,
			selectNotes,
			selectProject,
			updateNote,
		} = yield* Effect.try({
			try: () => ({
				selectProject: database.prepare(
					"SELECT project_id FROM projects WHERE project_id = ?",
				),
				selectNotes: database.prepare(`
					SELECT note_id, project_id, content, created_at_ms, updated_at_ms
					FROM project_notes
					WHERE project_id = ?
					ORDER BY updated_at_ms DESC, note_id DESC
				`),
				selectNote: database.prepare(`
					SELECT note_id, project_id, content, created_at_ms, updated_at_ms
					FROM project_notes
					WHERE project_id = ? AND note_id = ?
				`),
				selectLatestUpdatedAt: database.prepare(
					"SELECT MAX(updated_at_ms) AS updated_at_ms FROM project_notes WHERE project_id = ?",
				),
				insertNote: database.prepare(`
					INSERT INTO project_notes(
						note_id, project_id, content, created_at_ms, updated_at_ms
					) VALUES (?, ?, ?, ?, ?)
				`),
				updateNote: database.prepare(`
					UPDATE project_notes
					SET content = ?, updated_at_ms = ?
					WHERE project_id = ? AND note_id = ?
				`),
				deleteNote: database.prepare(
					"DELETE FROM project_notes WHERE project_id = ? AND note_id = ?",
				),
			}),
			catch: (cause) =>
				createRepositoryError(
					"list-notes",
					"The editor project note schema is incompatible.",
					cause,
				),
		});

		const listNotesFx: NoteOperations["listNotesFx"] = Effect.fn(
			"SqliteEditorProjectRepository.listNotesFx",
		)((projectId) =>
			Effect.try({
				try: () => {
					const validProjectId = IdSchema.parse(projectId);
					if (selectProject.get(validProjectId) === undefined)
						throw createRepositoryError(
							"list-notes",
							`Editor project ${validProjectId} does not exist.`,
						);
					return selectNotes.all(validProjectId).map((candidate) => {
						const result = SqliteEditorNoteRowSchema.safeParse(candidate);
						if (result.success) return result.data;
						throw createRepositoryError(
							"list-notes",
							"SQLite contains an invalid editor project note.",
							result.error,
						);
					});
				},
				catch: (cause) =>
					createRepositoryError(
						"list-notes",
						`Notes for project ${projectId} could not be listed.`,
						cause,
					),
			}),
		);

		const createNoteFx: NoteOperations["createNoteFx"] = Effect.fn(
			"SqliteEditorProjectRepository.createNoteFx",
		)(function* ({ projectId: candidateProjectId, content: candidateContent }) {
			const { projectId, content } = yield* Effect.try({
				try: () => ({
					projectId: IdSchema.parse(candidateProjectId),
					content: EditorNoteContentSchema.parse(candidateContent),
				}),
				catch: (cause) =>
					createRepositoryError(
						"create-note",
						"The editor project note is invalid.",
						cause,
					),
			});
			const clockMs = yield* Clock.currentTimeMillis;
			return yield* writeLock.withPermits(1)(
				runSqliteEditorProjectTransactionFx(database, () => {
					if (selectProject.get(projectId) === undefined)
						throw createRepositoryError(
							"create-note",
							`Editor project ${projectId} does not exist.`,
						);
					const latestUpdatedAt = selectLatestUpdatedAt.get(projectId)?.updated_at_ms;
					const createdAtMs =
						typeof latestUpdatedAt === "number"
							? Math.max(clockMs, latestUpdatedAt + 1)
							: clockMs;
					const note = EditorNoteSchema.parse({
						noteId: randomUUID(),
						projectId,
						content,
						createdAtMs,
						updatedAtMs: createdAtMs,
					});
					insertNote.run(
						note.noteId,
						note.projectId,
						note.content,
						note.createdAtMs,
						note.updatedAtMs,
					);
					return note;
				}).pipe(
					Effect.mapError((cause) =>
						createRepositoryError(
							"create-note",
							`A note could not be created in project ${projectId}.`,
							cause,
						),
					),
					Effect.uninterruptible,
				),
			);
		});

		const updateNoteFx: NoteOperations["updateNoteFx"] = Effect.fn(
			"SqliteEditorProjectRepository.updateNoteFx",
		)(function* ({
			projectId: candidateProjectId,
			noteId: candidateNoteId,
			content: candidateContent,
		}) {
			const { projectId, noteId, content } = yield* Effect.try({
				try: () => ({
					projectId: IdSchema.parse(candidateProjectId),
					noteId: IdSchema.parse(candidateNoteId),
					content: EditorNoteContentSchema.parse(candidateContent),
				}),
				catch: (cause) =>
					createRepositoryError(
						"update-note",
						"The editor project note is invalid.",
						cause,
					),
			});
			const nowMs = yield* Clock.currentTimeMillis;
			return yield* writeLock.withPermits(1)(
				runSqliteEditorProjectTransactionFx(database, () => {
					const previous = readNoteRow(selectNote, projectId, noteId, "update-note");
					if (previous === null)
						throw createRepositoryError(
							"update-note",
							`Editor note ${noteId} does not exist in project ${projectId}.`,
						);
					const latestUpdatedAt = selectLatestUpdatedAt.get(projectId)?.updated_at_ms;
					const note = EditorNoteSchema.parse({
						...previous,
						content,
						updatedAtMs:
							typeof latestUpdatedAt === "number"
								? Math.max(nowMs, latestUpdatedAt + 1)
								: nowMs,
					});
					updateNote.run(note.content, note.updatedAtMs, projectId, noteId);
					return note;
				}).pipe(
					Effect.mapError((cause) =>
						createRepositoryError(
							"update-note",
							`Editor note ${noteId} could not be updated in project ${projectId}.`,
							cause,
						),
					),
					Effect.uninterruptible,
				),
			);
		});

		const deleteNoteFx: NoteOperations["deleteNoteFx"] = Effect.fn(
			"SqliteEditorProjectRepository.deleteNoteFx",
		)(({ projectId: candidateProjectId, noteId: candidateNoteId }) =>
			Effect.try({
				try: () => ({
					projectId: IdSchema.parse(candidateProjectId),
					noteId: IdSchema.parse(candidateNoteId),
				}),
				catch: (cause) =>
					createRepositoryError(
						"delete-note",
						"The editor project note key is invalid.",
						cause,
					),
			}).pipe(
				Effect.flatMap(({ projectId, noteId }) =>
					writeLock.withPermits(1)(
						Effect.try({
							try: () => {
								if (deleteNote.run(projectId, noteId).changes !== 1)
									throw createRepositoryError(
										"delete-note",
										`Editor note ${noteId} does not exist in project ${projectId}.`,
									);
							},
							catch: (cause) =>
								createRepositoryError(
									"delete-note",
									`Editor note ${noteId} could not be deleted from project ${projectId}.`,
									cause,
								),
						}).pipe(Effect.uninterruptible),
					),
				),
			),
		);

		return {
			listNotesFx,
			createNoteFx,
			updateNoteFx,
			deleteNoteFx,
		} satisfies NoteOperations;
	},
);
