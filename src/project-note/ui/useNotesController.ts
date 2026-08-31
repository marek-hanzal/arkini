import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useEffect, useState } from "react";

import { NoteCommandAtoms } from "~/project-note/atom/NoteCommandAtoms";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { NoteContentMaxLength, type NoteSchema } from "~/project-note/schema/NoteSchema";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

export namespace useNotesController {
	export interface Output {
		readonly cancelEdit: () => void;
		readonly canCreate: boolean;
		readonly canSaveEdit: boolean;
		readonly create: () => void;
		readonly editContent: string;
		readonly editingNoteId?: string;
		readonly error?: unknown;
		readonly loaded: boolean;
		readonly loading: boolean;
		readonly newContent: string;
		readonly notes: ReadonlyArray<NoteSchema.Type>;
		readonly pending: boolean;
		readonly remove: (noteId: string) => void;
		readonly retry: () => void;
		readonly saveEdit: () => void;
		readonly setEditContent: (content: string) => void;
		readonly setNewContent: (content: string) => void;
		readonly startEdit: (note: NoteSchema.Type) => void;
	}
}

export const useNotesController = (): useNotesController.Output => {
	const project = useEditorProject();
	const commandAtom = NoteCommandAtoms.command(project.projectId);
	const streamAtom = NoteCommandAtoms.stream(project.projectId);
	const commandResult = useAtomValue(commandAtom);
	const notes = useAtomValue(streamAtom);
	const run = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const [editContent, setEditContent] = useState("");
	const [editingNoteId, setEditingNoteId] = useState<string>();
	const [newContent, setNewContent] = useState("");

	useEffect(() => {
		if (notes !== undefined || !AsyncResult.isInitial(commandResult)) return;
		void run({
			action: "load",
		}).catch(() => undefined);
	}, [
		commandResult,
		notes,
		run,
	]);

	const loaded = notes !== undefined;
	const loading = !loaded && (AsyncResult.isInitial(commandResult) || commandResult.waiting);
	const pending = commandResult.waiting;
	const error = RendererRuntime.runSync(readSettledAsyncResultErrorFx(commandResult));
	const newContentLength = newContent.trim().length;
	const editContentLength = editContent.trim().length;
	const canCreate =
		loaded && !pending && newContentLength > 0 && newContentLength <= NoteContentMaxLength;
	const canSaveEdit =
		!pending && editContentLength > 0 && editContentLength <= NoteContentMaxLength;
	const create = () => {
		if (!canCreate) return;
		void run({
			action: "create",
			content: newContent,
		})
			.then(() => setNewContent(""))
			.catch(() => undefined);
	};
	const startEdit = (note: NoteSchema.Type) => {
		setEditingNoteId(note.noteId);
		setEditContent(note.content);
	};
	const cancelEdit = () => {
		if (pending) return;
		setEditingNoteId(undefined);
		setEditContent("");
	};
	const saveEdit = () => {
		if (!canSaveEdit || editingNoteId === undefined) return;
		void run({
			action: "update",
			noteId: editingNoteId,
			content: editContent,
		})
			.then(() => {
				setEditingNoteId(undefined);
				setEditContent("");
			})
			.catch(() => undefined);
	};
	const remove = (noteId: string) => {
		if (pending) return;
		void run({
			action: "delete",
			noteId,
		}).catch(() => undefined);
	};
	const retry = () => {
		if (pending) return;
		void run({
			action: "load",
		}).catch(() => undefined);
	};

	return {
		cancelEdit,
		canCreate,
		canSaveEdit,
		create,
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
		notes: notes ?? [],
		pending,
		remove,
		retry,
		saveEdit,
		setEditContent,
		setNewContent,
		startEdit,
	};
};
