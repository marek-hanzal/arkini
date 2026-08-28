import { randomUUID } from "node:crypto";
import { Clock, FileSystem } from "effect";
import { Effect, type Semaphore } from "effect";

import type { ProjectState } from "../ProjectState";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { EditorProjectNoteFileSchema } from "~/editor/filesystem/EditorProjectNoteFileSchema";
import { EditorNoteContentSchema, EditorNoteSchema } from "~/editor/note/EditorNoteSchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import type { FilesystemWrite } from "~/engine/filesystem/FilesystemWrite";
import { withFilesystemWriteRecovery } from "~/engine/filesystem/FilesystemWriteError";
import { withProjectLockFx } from "./withProjectLockFx";

const encoder = new TextEncoder();
const encodeJson = (value: unknown) =>
	encoder.encode(`${JSON.stringify(value, undefined, "\t")}\n`);

type Operations = Pick<
	EditorProjectRepositoryService,
	"listNotesFx" | "createNoteFx" | "updateNoteFx" | "deleteNoteFx"
>;

const error = (
	operation: "list-notes" | "create-note" | "update-note" | "delete-note",
	message: string,
	cause?: unknown,
) =>
	cause instanceof EditorProjectRepositoryError && cause.operation === operation
		? cause
		: new EditorProjectRepositoryError({
				operation,
				message: withFilesystemWriteRecovery(message, cause),
				cause,
			});

export namespace createNoteOperationsFx {
	export interface Props {
		readonly filesystemWrite: FilesystemWrite;
		readonly operations: Semaphore.Semaphore;
		readonly readState: (
			projectId: string,
		) => Effect.Effect<ProjectState, EditorProjectRepositoryError>;
		readonly states: Map<string, ProjectState>;
	}
}

/** Stores each portable Editor note as one independent JSON file. */
export const createNoteOperationsFx = Effect.fn("createNoteOperationsFx")(function* ({
	filesystemWrite,
	operations,
	readState,
	states,
}: createNoteOperationsFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;

	const readNotesFx = (projectId: string) =>
		readState(projectId).pipe(
			Effect.map((state) => [
				...state.notes,
			]),
		);
	const publishNotes = (state: ProjectState, notes: ReadonlyArray<EditorNoteSchema.Type>) =>
		states.set(state.project.projectId, {
			...state,
			notes: [
				...notes,
			].sort(
				(left, right) =>
					right.updatedAtMs - left.updatedAtMs || right.noteId.localeCompare(left.noteId),
			),
		});

	const listNotesFx: Operations["listNotesFx"] = (projectId) =>
		operations.withPermits(1)(
			readNotesFx(projectId).pipe(
				Effect.map((notes) =>
					notes.sort(
						(left, right) =>
							right.updatedAtMs - left.updatedAtMs ||
							right.noteId.localeCompare(left.noteId),
					),
				),
				Effect.mapError((cause) =>
					error(
						"list-notes",
						`Notes for project ${projectId} could not be listed.`,
						cause,
					),
				),
			),
		);

	const createNoteFx: Operations["createNoteFx"] = ({ projectId, content: candidate }) =>
		Effect.gen(function* () {
			const content = yield* Effect.try({
				try: () => EditorNoteContentSchema.parse(candidate),
				catch: (cause) =>
					error("create-note", "The Editor project note is invalid.", cause),
			});
			const clockMs = yield* Clock.currentTimeMillis;
			return yield* operations.withPermits(1)(
				Effect.gen(function* () {
					const state = yield* readState(projectId);
					const notes = yield* readNotesFx(projectId);
					const latest = notes[0]?.updatedAtMs;
					const createdAtMs =
						latest === undefined ? clockMs : Math.max(clockMs, latest + 1);
					const note = EditorNoteSchema.parse({
						noteId: randomUUID(),
						projectId,
						content,
						createdAtMs,
						updatedAtMs: createdAtMs,
					});
					const target = yield* state.paths.noteFileFx(note.noteId);
					yield* withProjectLockFx(
						filesystemWrite,
						state.paths.root,
						filesystemWrite.replaceFileFx({
							lock: state.paths.lockFile,
							target,
							bytes: encodeJson(
								EditorProjectNoteFileSchema.parse({
									content: note.content,
									createdAtMs: note.createdAtMs,
									updatedAtMs: note.updatedAtMs,
								}),
							),
						}),
					);
					publishNotes(state, [
						note,
						...notes,
					]);
					return note;
				}),
			);
		}).pipe(
			Effect.mapError((cause) =>
				error("create-note", `A note could not be created in project ${projectId}.`, cause),
			),
		);

	const updateNoteFx: Operations["updateNoteFx"] = ({
		projectId,
		noteId: candidateId,
		content: candidate,
	}) =>
		Effect.gen(function* () {
			const { noteId, content } = yield* Effect.try({
				try: () => ({
					noteId: IdSchema.parse(candidateId),
					content: EditorNoteContentSchema.parse(candidate),
				}),
				catch: (cause) =>
					error("update-note", "The Editor project note is invalid.", cause),
			});
			const clockMs = yield* Clock.currentTimeMillis;
			return yield* operations.withPermits(1)(
				Effect.gen(function* () {
					const state = yield* readState(projectId);
					const notes = yield* readNotesFx(projectId);
					const previous = notes.find((note) => note.noteId === noteId);
					if (previous === undefined)
						return yield* Effect.fail(
							error(
								"update-note",
								`Editor note ${noteId} does not exist in project ${projectId}.`,
							),
						);
					const latest = notes[0]?.updatedAtMs ?? previous.updatedAtMs;
					const note = EditorNoteSchema.parse({
						...previous,
						content,
						updatedAtMs: Math.max(clockMs, latest + 1),
					});
					const target = yield* state.paths.noteFileFx(noteId);
					yield* withProjectLockFx(
						filesystemWrite,
						state.paths.root,
						filesystemWrite.replaceFileFx({
							lock: state.paths.lockFile,
							target,
							bytes: encodeJson({
								content: note.content,
								createdAtMs: note.createdAtMs,
								updatedAtMs: note.updatedAtMs,
							}),
						}),
					);
					publishNotes(state, [
						note,
						...notes.filter((candidate) => candidate.noteId !== noteId),
					]);
					return note;
				}),
			);
		}).pipe(
			Effect.mapError((cause) =>
				error(
					"update-note",
					`Editor note ${candidateId} could not be updated in project ${projectId}.`,
					cause,
				),
			),
		);

	const deleteNoteFx: Operations["deleteNoteFx"] = ({ projectId, noteId: candidateId }) =>
		Effect.gen(function* () {
			const noteId = yield* Effect.try({
				try: () => IdSchema.parse(candidateId),
				catch: (cause) => error("delete-note", "The Editor note key is invalid.", cause),
			});
			return yield* operations.withPermits(1)(
				Effect.gen(function* () {
					const state = yield* readState(projectId);
					const target = yield* state.paths.noteFileFx(noteId);
					if (!(yield* fileSystem.exists(target)))
						return yield* Effect.fail(
							error(
								"delete-note",
								`Editor note ${noteId} does not exist in project ${projectId}.`,
							),
						);
					yield* withProjectLockFx(
						filesystemWrite,
						state.paths.root,
						filesystemWrite.removeFileFx({
							lock: state.paths.lockFile,
							target,
						}),
					);
					publishNotes(
						state,
						state.notes.filter((note) => note.noteId !== noteId),
					);
				}),
			);
		}).pipe(
			Effect.mapError((cause) =>
				error(
					"delete-note",
					`Editor note ${candidateId} could not be deleted from project ${projectId}.`,
					cause,
				),
			),
		);

	return {
		listNotesFx,
		createNoteFx,
		updateNoteFx,
		deleteNoteFx,
	} satisfies Operations;
});
