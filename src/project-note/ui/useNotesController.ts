import { useEffect, useState } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { NoteContentMaxLength, type NoteSchema } from "~/project-note/schema/NoteSchema";
import { useProjectNotes } from "~/project-note/ui/useProjectNotes";

export namespace useNotesController {
	export interface Output {
		readonly cancelEditFn: () => void;
		readonly canCreate: boolean;
		readonly canSaveEdit: boolean;
		readonly createFn: () => void;
		readonly editContent: string;
		readonly editingNoteId?: string;
		readonly error?: unknown;
		readonly loaded: boolean;
		readonly loading: boolean;
		readonly newContent: string;
		readonly notes: ReadonlyArray<NoteSchema.Type>;
		readonly pending: boolean;
		readonly removeFn: (note: NoteSchema.Type) => void;
		readonly retryFn: () => void;
		readonly saveEditFn: () => void;
		readonly setEditContentFn: (content: string) => void;
		readonly setNewContentFn: (content: string) => void;
		readonly startEditFn: (note: NoteSchema.Type) => void;
	}
}

export const useNotesController = (): useNotesController.Output => {
	const project = useEditorProject();
	const { error, loaded, loading, notes, pending, runFn } = useProjectNotes(project.projectId);
	const [editContent, setEditContentFn] = useState("");
	const [editingNote, setEditingNoteFn] = useState<
		Pick<NoteSchema.Type, "noteId" | "updatedAtMs"> | undefined
	>();
	const [newContent, setNewContentFn] = useState("");
	const editingNoteId = editingNote?.noteId;

	useEffect(() => {
		if (editingNoteId === undefined || notes.some((note) => note.noteId === editingNoteId))
			return;
		setEditingNoteFn(undefined);
		setEditContentFn("");
	}, [
		editingNoteId,
		notes,
	]);

	const newContentLength = newContent.trim().length;
	const editContentLength = editContent.trim().length;
	const canCreate =
		loaded && !pending && newContentLength > 0 && newContentLength <= NoteContentMaxLength;
	const canSaveEdit =
		!pending && editContentLength > 0 && editContentLength <= NoteContentMaxLength;
	const createFn = () => {
		if (!canCreate) return;
		void runFn({
			action: "create",
			content: newContent,
		})
			.then(() => setNewContentFn(""))
			.catch(() => undefined);
	};
	const startEditFn = (note: NoteSchema.Type) => {
		setEditingNoteFn({
			noteId: note.noteId,
			updatedAtMs: note.updatedAtMs,
		});
		setEditContentFn(note.content);
	};
	const cancelEditFn = () => {
		if (pending) return;
		setEditingNoteFn(undefined);
		setEditContentFn("");
	};
	const saveEditFn = () => {
		if (!canSaveEdit || editingNote === undefined) return;
		void runFn({
			action: "update",
			noteId: editingNote.noteId,
			content: editContent,
			expectedUpdatedAtMs: editingNote.updatedAtMs,
		})
			.then(() => {
				setEditingNoteFn(undefined);
				setEditContentFn("");
			})
			.catch(() => undefined);
	};
	const removeFn = (note: NoteSchema.Type) => {
		if (pending) return;
		void runFn({
			action: "delete",
			noteId: note.noteId,
			expectedUpdatedAtMs: note.updatedAtMs,
		}).catch(() => undefined);
	};
	const retryFn = () => {
		if (pending) return;
		void runFn({
			action: "load",
		}).catch(() => undefined);
	};

	return {
		cancelEditFn,
		canCreate,
		canSaveEdit,
		createFn,
		editContent,
		...(editingNoteId === undefined
			? {}
			: {
					editingNoteId,
				}),
		...(error === undefined
			? {}
			: {
					error,
				}),
		loading,
		loaded,
		newContent,
		notes,
		pending,
		removeFn,
		retryFn,
		saveEditFn,
		setEditContentFn,
		setNewContentFn,
		startEditFn,
	};
};
