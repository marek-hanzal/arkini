import { Effect } from "effect";

import { createEditorNotesCommandAtomsFx } from "~/bridge/editor/note/createEditorNotesCommandAtomsFx";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";

export const editorNotesTestState = {
	createFailures: 0,
	listFailures: 0,
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

const repository = {
	listNotesFx: () =>
		Effect.try({
			try: () => {
				if (editorNotesTestState.listFailures > 0) {
					editorNotesTestState.listFailures -= 1;
					throw new Error("Notes could not be loaded.");
				}
				return editorNotesTestState.notes;
			},
			catch: (cause) =>
				new EditorProjectRepositoryError({
					operation: "list-notes",
					message: cause instanceof Error ? cause.message : String(cause),
					cause,
				}),
		}),
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
				new EditorProjectRepositoryError({
					operation: "create-note",
					message: cause instanceof Error ? cause.message : String(cause),
					cause,
				}),
		}),
	updateNoteFx: ({ content, noteId }: { content: string; noteId: string; projectId: string }) =>
		Effect.try({
			try: () => {
				const note = editorNotesTestState.notes.find(
					(candidate) => candidate.noteId === noteId,
				);
				if (note === undefined) throw new Error("Missing note.");
				const updated = {
					...note,
					content,
					updatedAtMs:
						Math.max(
							...editorNotesTestState.notes.map(({ updatedAtMs }) => updatedAtMs),
						) + 1,
				};
				editorNotesTestState.notes = [
					updated,
					...editorNotesTestState.notes.filter(
						(candidate) => candidate.noteId !== noteId,
					),
				];
				return updated;
			},
			catch: (cause) =>
				new EditorProjectRepositoryError({
					operation: "update-note",
					message: cause instanceof Error ? cause.message : String(cause),
					cause,
				}),
		}),
	deleteNoteFx: ({ noteId }: { noteId: string; projectId: string }) =>
		Effect.sync(() => {
			editorNotesTestState.notes = editorNotesTestState.notes.filter(
				(note) => note.noteId !== noteId,
			);
		}),
};

export const EditorNotesTestCommandAtoms = Effect.runSync(
	createEditorNotesCommandAtomsFx(repository),
);
