import { Effect } from "effect";

import { createEditorNotesCommandAtomsFx } from "~/project-note/workspace/createEditorNotesCommandAtomsFx";
import { EditorProjectRepositoryError } from "~/project-authoring/repository/EditorProjectRepositoryError";

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

const repository = {
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
				new EditorProjectRepositoryError({
					operation: "create-note",
					message: cause instanceof Error ? cause.message : String(cause),
					cause,
				}),
		}),
	updateNoteFx: () => Effect.die("Unexpected note update."),
	deleteNoteFx: () => Effect.die("Unexpected note delete."),
};

export const EditorNotesTestCommandAtoms = Effect.runSync(
	createEditorNotesCommandAtomsFx(repository),
);
