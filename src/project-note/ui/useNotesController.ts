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
		readonly removeFn: (noteId: string) => void;
		readonly retryFn: () => void;
		readonly saveEditFn: () => void;
		readonly setEditContentFn: (content: string) => void;
		readonly setNewContentFn: (content: string) => void;
		readonly startEditFn: (note: NoteSchema.Type) => void;
	}
}

export const useNotesController = (): useNotesController.Output => {
	const project = useEditorProject();
	const commandAtom = NoteCommandAtoms.commandFn(project.projectId);
	const streamAtom = NoteCommandAtoms.streamFn(project.projectId);
	const commandResult = useAtomValue(commandAtom);
	const notes = useAtomValue(streamAtom);
	const runFn = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const [editContent, setEditContentFn] = useState("");
	const [editingNoteId, setEditingNoteIdFn] = useState<string>();
	const [newContent, setNewContentFn] = useState("");

	useEffect(() => {
		if (notes !== undefined || !AsyncResult.isInitial(commandResult)) return;
		void runFn({
			action: "load",
		}).catch(() => undefined);
	}, [
		commandResult,
		notes,
		runFn,
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
		setEditingNoteIdFn(note.noteId);
		setEditContentFn(note.content);
	};
	const cancelEditFn = () => {
		if (pending) return;
		setEditingNoteIdFn(undefined);
		setEditContentFn("");
	};
	const saveEditFn = () => {
		if (!canSaveEdit || editingNoteId === undefined) return;
		void runFn({
			action: "update",
			noteId: editingNoteId,
			content: editContent,
		})
			.then(() => {
				setEditingNoteIdFn(undefined);
				setEditContentFn("");
			})
			.catch(() => undefined);
	};
	const removeFn = (noteId: string) => {
		if (pending) return;
		void runFn({
			action: "delete",
			noteId,
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
		notes: notes ?? [],
		pending,
		removeFn,
		retryFn,
		saveEditFn,
		setEditContentFn,
		setNewContentFn,
		startEditFn,
	};
};
