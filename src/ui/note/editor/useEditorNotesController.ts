import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EditorNotesCommandAtoms } from "~/ui/note/editor/EditorNotesCommandAtoms";
import { useEditorProject } from "~/ui/editor/useEditorProject";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import { EditorNoteContentMaxLength, type EditorNoteSchema } from "~/editor/note/EditorNoteSchema";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";

export namespace useEditorNotesController {
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
		readonly notes: ReadonlyArray<EditorNoteSchema.Type>;
		readonly pending: boolean;
		readonly remove: (noteId: string) => void;
		readonly retry: () => void;
		readonly saveEdit: () => void;
		readonly setEditContent: (content: string) => void;
		readonly setNewContent: (content: string) => void;
		readonly startEdit: (note: EditorNoteSchema.Type) => void;
	}
}

export const useEditorNotesController = (): useEditorNotesController.Output => {
	const project = useEditorProject();
	const commandAtom = EditorNotesCommandAtoms.command(project.projectId);
	const streamAtom = EditorNotesCommandAtoms.stream(project.projectId);
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
		loaded &&
		!pending &&
		newContentLength > 0 &&
		newContentLength <= EditorNoteContentMaxLength;
	const canSaveEdit =
		!pending && editContentLength > 0 && editContentLength <= EditorNoteContentMaxLength;
	const create = useCallback(() => {
		if (!canCreate) return;
		void run({
			action: "create",
			content: newContent,
		})
			.then(() => setNewContent(""))
			.catch(() => undefined);
	}, [
		canCreate,
		newContent,
		run,
	]);
	const startEdit = useCallback((note: EditorNoteSchema.Type) => {
		setEditingNoteId(note.noteId);
		setEditContent(note.content);
	}, []);
	const cancelEdit = useCallback(() => {
		if (pending) return;
		setEditingNoteId(undefined);
		setEditContent("");
	}, [
		pending,
	]);
	const saveEdit = useCallback(() => {
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
	}, [
		canSaveEdit,
		editContent,
		editingNoteId,
		run,
	]);
	const remove = useCallback(
		(noteId: string) => {
			if (pending) return;
			void run({
				action: "delete",
				noteId,
			}).catch(() => undefined);
		},
		[
			pending,
			run,
		],
	);
	const retry = useCallback(() => {
		if (pending) return;
		void run({
			action: "load",
		}).catch(() => undefined);
	}, [
		pending,
		run,
	]);

	return useMemo(
		() => ({
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
		}),
		[
			cancelEdit,
			canCreate,
			canSaveEdit,
			create,
			editContent,
			editingNoteId,
			error,
			loading,
			loaded,
			newContent,
			notes,
			pending,
			remove,
			retry,
			saveEdit,
			startEdit,
		],
	);
};
