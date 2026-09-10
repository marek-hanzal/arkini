import { randomUUID } from "node:crypto";
import { Clock, FileSystem } from "effect";
import { Effect, type Semaphore } from "effect";

import type { ProjectState } from "../ProjectState";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { NoteFileSchema } from "~/project-note/schema/NoteFileSchema";
import { NoteContentSchema, NoteSchema } from "~/project-note/schema/NoteSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import type { FilesystemWrite } from "~/filesystem-write/service/FilesystemWrite";
import { withFilesystemWriteRecoveryFn } from "~/filesystem-write/fn/withFilesystemWriteRecoveryFn";
import { withProjectLockFx } from "./withProjectLockFx";

const encoder = new TextEncoder();
const encodeJsonFn = (value: unknown) =>
	encoder.encode(`${JSON.stringify(value, undefined, "\t")}\n`);

type Operations = Pick<
	ProjectRepositoryService,
	"listNotesFx" | "createNoteFx" | "updateNoteFx" | "deleteNoteFx"
>;

const errorFn = (
	operation: "list-notes" | "create-note" | "update-note" | "delete-note",
	message: string,
	cause?: unknown,
) =>
	cause instanceof ProjectRepositoryError && cause.operation === operation
		? cause
		: new ProjectRepositoryError({
				operation,
				message: withFilesystemWriteRecoveryFn(message, cause),
				cause,
			});

const assertLinksFx = (
	state: ProjectState,
	itemUids: ReadonlyArray<string>,
	resourceIds: ReadonlyArray<string>,
	operation: "create-note" | "update-note",
) => {
	const existingItemUids = new Set(
		Object.values(state.project.config.items).map((item) => item.uid),
	);
	const missingItemUids = itemUids.filter((uid) => !existingItemUids.has(uid));
	if (missingItemUids.length > 0)
		return Effect.fail(
			errorFn(
				operation,
				`Linked item UIDs do not exist in the open project: ${missingItemUids.join(", ")}.`,
			),
		);
	const existingResourceIds = new Set(state.project.resources.map((resource) => resource.id));
	const missingResourceIds = resourceIds.filter((id) => !existingResourceIds.has(id));
	return missingResourceIds.length === 0
		? Effect.void
		: Effect.fail(
				errorFn(
					operation,
					`Linked resource IDs do not exist in the open project: ${missingResourceIds.join(", ")}.`,
				),
			);
};

export namespace createNoteOperationsFx {
	export interface Props {
		readonly filesystemWrite: FilesystemWrite;
		readonly operations: Semaphore.Semaphore;
		readonly readStateFx: (
			projectId: string,
		) => Effect.Effect<ProjectState, ProjectRepositoryError, never>;
		readonly states: Map<string, ProjectState>;
	}
}

/** Stores each portable Editor note as one independent JSON file. */
export const createNoteOperationsFx = Effect.fn("createNoteOperationsFx")(function* ({
	filesystemWrite,
	operations,
	readStateFx,
	states,
}: createNoteOperationsFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;

	const readNotesFx = (projectId: string) =>
		readStateFx(projectId).pipe(
			Effect.map((state) => [
				...state.notes.map((note) => ({
					...note,
					itemUids: [
						...note.itemUids,
					],
					resourceIds: [
						...note.resourceIds,
					],
				})),
			]),
		);
	const publishNotesFn = (state: ProjectState, notes: ReadonlyArray<NoteSchema.Type>) =>
		states.set(state.project.projectId, {
			...state,
			notes: [
				...notes.map((note) => ({
					...note,
					itemUids: [
						...note.itemUids,
					],
					resourceIds: [
						...note.resourceIds,
					],
				})),
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
					errorFn(
						"list-notes",
						`Notes for project ${projectId} could not be listed.`,
						cause,
					),
				),
			),
		);

	const createNoteFx: Operations["createNoteFx"] = ({
		projectId,
		content: candidate,
		itemUids: candidateItemUids,
		resourceIds: candidateResourceIds,
	}) =>
		Effect.gen(function* () {
			const { content, itemUids, resourceIds } = yield* Effect.try({
				try: () => ({
					content: NoteContentSchema.parse(candidate),
					itemUids: NoteSchema.shape.itemUids.parse(candidateItemUids),
					resourceIds: NoteSchema.shape.resourceIds.parse(candidateResourceIds),
				}),
				catch: (cause) =>
					errorFn("create-note", "The Editor project note is invalid.", cause),
			});
			const clockMs = yield* Clock.currentTimeMillis;
			return yield* operations.withPermits(1)(
				Effect.gen(function* () {
					const state = yield* readStateFx(projectId);
					const notes = yield* readNotesFx(projectId);
					yield* assertLinksFx(state, itemUids, resourceIds, "create-note");
					const latest = notes[0]?.updatedAtMs;
					const createdAtMs =
						latest === undefined ? clockMs : Math.max(clockMs, latest + 1);
					const note = NoteSchema.parse({
						noteId: randomUUID(),
						projectId,
						content,
						itemUids,
						resourceIds,
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
							bytes: encodeJsonFn(
								NoteFileSchema.parse({
									content: note.content,
									itemUids: note.itemUids,
									resourceIds: note.resourceIds,
									createdAtMs: note.createdAtMs,
									updatedAtMs: note.updatedAtMs,
								}),
							),
						}),
					);
					publishNotesFn(state, [
						note,
						...notes,
					]);
					return note;
				}),
			);
		}).pipe(
			Effect.mapError((cause) =>
				errorFn(
					"create-note",
					`A note could not be created in project ${projectId}.`,
					cause,
				),
			),
		);

	const updateNoteFx: Operations["updateNoteFx"] = ({
		projectId,
		noteId: candidateId,
		content: candidate,
		itemUids: candidateItemUids,
		resourceIds: candidateResourceIds,
		expectedUpdatedAtMs: candidateExpectedUpdatedAtMs,
	}) =>
		Effect.gen(function* () {
			const { noteId, content, itemUids, resourceIds, expectedUpdatedAtMs } =
				yield* Effect.try({
					try: () => ({
						noteId: IdSchema.parse(candidateId),
						content: NoteContentSchema.parse(candidate),
						itemUids: NoteSchema.shape.itemUids.parse(candidateItemUids),
						resourceIds: NoteSchema.shape.resourceIds.parse(candidateResourceIds),
						expectedUpdatedAtMs: NonNegativeIntegerSchema.parse(
							candidateExpectedUpdatedAtMs,
						),
					}),
					catch: (cause) =>
						errorFn("update-note", "The Editor project note is invalid.", cause),
				});
			const clockMs = yield* Clock.currentTimeMillis;
			return yield* operations.withPermits(1)(
				Effect.gen(function* () {
					const state = yield* readStateFx(projectId);
					const notes = yield* readNotesFx(projectId);
					const previous = notes.find((note) => note.noteId === noteId);
					if (previous === undefined)
						return yield* Effect.fail(
							errorFn(
								"update-note",
								`Editor note ${noteId} does not exist in project ${projectId}.`,
							),
						);
					if (previous.updatedAtMs !== expectedUpdatedAtMs)
						return yield* Effect.fail(
							errorFn(
								"update-note",
								`Editor note ${noteId} changed after it was read.`,
							),
						);
					yield* assertLinksFx(state, itemUids, resourceIds, "update-note");
					const latest = notes[0]?.updatedAtMs ?? previous.updatedAtMs;
					const note = NoteSchema.parse({
						...previous,
						content,
						itemUids,
						resourceIds,
						updatedAtMs: Math.max(clockMs, latest + 1),
					});
					const target = yield* state.paths.noteFileFx(noteId);
					yield* withProjectLockFx(
						filesystemWrite,
						state.paths.root,
						filesystemWrite.replaceFileFx({
							lock: state.paths.lockFile,
							target,
							bytes: encodeJsonFn({
								content: note.content,
								itemUids: note.itemUids,
								resourceIds: note.resourceIds,
								createdAtMs: note.createdAtMs,
								updatedAtMs: note.updatedAtMs,
							}),
						}),
					);
					publishNotesFn(state, [
						note,
						...notes.filter((candidate) => candidate.noteId !== noteId),
					]);
					return note;
				}),
			);
		}).pipe(
			Effect.mapError((cause) =>
				errorFn(
					"update-note",
					`Editor note ${candidateId} could not be updated in project ${projectId}.`,
					cause,
				),
			),
		);

	const deleteNoteFx: Operations["deleteNoteFx"] = ({
		projectId,
		noteId: candidateId,
		expectedUpdatedAtMs: candidateExpectedUpdatedAtMs,
	}) =>
		Effect.gen(function* () {
			const { noteId, expectedUpdatedAtMs } = yield* Effect.try({
				try: () => ({
					noteId: IdSchema.parse(candidateId),
					expectedUpdatedAtMs: NonNegativeIntegerSchema.parse(
						candidateExpectedUpdatedAtMs,
					),
				}),
				catch: (cause) => errorFn("delete-note", "The Editor note key is invalid.", cause),
			});
			return yield* operations.withPermits(1)(
				Effect.gen(function* () {
					const state = yield* readStateFx(projectId);
					const previous = state.notes.find((note) => note.noteId === noteId);
					const target = yield* state.paths.noteFileFx(noteId);
					if (previous === undefined || !(yield* fileSystem.exists(target)))
						return yield* Effect.fail(
							errorFn(
								"delete-note",
								`Editor note ${noteId} does not exist in project ${projectId}.`,
							),
						);
					if (previous.updatedAtMs !== expectedUpdatedAtMs)
						return yield* Effect.fail(
							errorFn(
								"delete-note",
								`Editor note ${noteId} changed after it was read.`,
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
					publishNotesFn(
						state,
						state.notes.filter((note) => note.noteId !== noteId),
					);
				}),
			);
		}).pipe(
			Effect.mapError((cause) =>
				errorFn(
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
