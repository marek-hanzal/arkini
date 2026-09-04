import { Effect } from "effect";

import { createNoteCommandAtomsFx } from "~/project-note/fx/createNoteCommandAtomsFx";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";

export const editorNotesTestState = {
	createFailures: 0,
	nextNote: 2,
	notes: [
		{
			noteId: "note-one",
			projectId: "project-one",
			content: "Existing note",
			createdAtMs: 1,
			updatedAtMs: 1,
		},
	],
};

const repository: Pick<
	ProjectRepositoryService,
	"listNotesFx" | "createNoteFx" | "updateNoteFx" | "deleteNoteFx"
> = {
	listNotesFx: () => Effect.succeed(editorNotesTestState.notes),
	createNoteFx: ({ projectId, content }: { projectId: string; content: string }) =>
		Effect.try({
			try: () => {
				if (editorNotesTestState.createFailures > 0) {
					editorNotesTestState.createFailures -= 1;
					throw new Error("Note could not be saved.");
				}
				const note = {
					noteId: `note-${editorNotesTestState.nextNote++}`,
					projectId,
					content,
					createdAtMs: editorNotesTestState.nextNote,
					updatedAtMs: editorNotesTestState.nextNote,
				};
				editorNotesTestState.notes = [
					note,
					...editorNotesTestState.notes,
				];
				return note;
			},
			catch: (cause) =>
				new ProjectRepositoryError({
					operation: "create-note",
					message: cause instanceof Error ? cause.message : String(cause),
					cause,
				}),
		}),
	updateNoteFx: ({ projectId, noteId, content, expectedUpdatedAtMs }) =>
		Effect.try({
			try: () => {
				const previous = editorNotesTestState.notes.find((note) => note.noteId === noteId);
				if (previous === undefined)
					throw new Error(`Editor note ${noteId} does not exist.`);
				if (previous.updatedAtMs !== expectedUpdatedAtMs)
					throw new Error(`Editor note ${noteId} changed after it was read.`);
				const updated = {
					...previous,
					projectId,
					content,
					updatedAtMs: Math.max(
						editorNotesTestState.nextNote++,
						...editorNotesTestState.notes.map((note) => note.updatedAtMs + 1),
					),
				};
				editorNotesTestState.notes = [
					updated,
					...editorNotesTestState.notes.filter((note) => note.noteId !== noteId),
				];
				return updated;
			},
			catch: (cause) =>
				new ProjectRepositoryError({
					operation: "update-note",
					message: cause instanceof Error ? cause.message : String(cause),
					cause,
				}),
		}),
	deleteNoteFx: ({ noteId, expectedUpdatedAtMs }) =>
		Effect.try({
			try: () => {
				const previous = editorNotesTestState.notes.find((note) => note.noteId === noteId);
				if (previous === undefined)
					throw new Error(`Editor note ${noteId} does not exist.`);
				if (previous.updatedAtMs !== expectedUpdatedAtMs)
					throw new Error(`Editor note ${noteId} changed after it was read.`);
				editorNotesTestState.notes = editorNotesTestState.notes.filter(
					(note) => note.noteId !== noteId,
				);
			},
			catch: (cause) =>
				new ProjectRepositoryError({
					operation: "delete-note",
					message: cause instanceof Error ? cause.message : String(cause),
					cause,
				}),
		}),
};

export const EditorNotesTestCommandAtoms = Effect.runSync(createNoteCommandAtomsFx(repository));
