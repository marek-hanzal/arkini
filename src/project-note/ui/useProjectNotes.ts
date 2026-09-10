import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useEffect, useRef, useState } from "react";

import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { NoteCommandAtoms } from "~/project-note/atom/NoteCommandAtoms";
import type { createNoteCommandAtomsFx } from "~/project-note/fx/createNoteCommandAtomsFx";
import type { NoteSchema } from "~/project-note/schema/NoteSchema";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

export namespace useProjectNotes {
	export interface Output {
		readonly error?: unknown;
		readonly loaded: boolean;
		readonly loading: boolean;
		readonly notes: ReadonlyArray<NoteSchema.Type>;
		readonly pending: boolean;
		readonly runFn: (command: createNoteCommandAtomsFx.Command) => Promise<void>;
	}
}

/** Mounts the canonical project Notes stream and refreshes it after external mutations. */
export const useProjectNotes = (projectId: string): useProjectNotes.Output => {
	const project = useAtomValue(EditorProjectAtom(projectId));
	const previousRevision = useRef(project?.revision);
	const commandAtom = NoteCommandAtoms.commandFn(projectId);
	const refreshAtom = NoteCommandAtoms.refreshFn(projectId);
	const streamAtom = NoteCommandAtoms.streamFn(projectId);
	const commandResult = useAtomValue(commandAtom);
	const refreshResult = useAtomValue(refreshAtom);
	const notes = useAtomValue(streamAtom);
	const [refreshRequested, setRefreshRequestedFn] = useState(false);
	const mutateFn = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const resetCommandFn = useAtomSet(commandAtom);
	const refreshFn = useAtomSet(refreshAtom, {
		mode: "promise",
	});
	const pending = commandResult.waiting || refreshResult.waiting;
	const runFn = (command: createNoteCommandAtomsFx.Command) => {
		if (command.action !== "load") return mutateFn(command);
		resetCommandFn(Atom.Reset);
		return refreshFn(undefined);
	};

	useEffect(() => {
		if (previousRevision.current === project?.revision) return;
		previousRevision.current = project?.revision;
		// Local repository commits can prune links without an external MCP event.
		setRefreshRequestedFn(true);
	}, [
		project?.revision,
	]);

	useEffect(() => {
		if (pending) return;
		if (!refreshRequested && (notes !== undefined || !AsyncResult.isInitial(refreshResult)))
			return;
		setRefreshRequestedFn(false);
		void refreshFn(undefined).catch(() => undefined);
	}, [
		notes,
		pending,
		refreshFn,
		refreshResult,
		refreshRequested,
	]);
	useEffect(
		() =>
			window.arkini.editor.onProjectChangedFn((changedProjectId) => {
				if (changedProjectId !== projectId) return;
				// Publish the next read only after any pending write has settled.
				setRefreshRequestedFn(true);
			}),
		[
			projectId,
		],
	);

	const loaded = notes !== undefined;
	const commandError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(commandResult));
	const refreshError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(refreshResult));
	const error = commandError ?? refreshError;
	return {
		...(error === undefined
			? {}
			: {
					error,
				}),
		loaded,
		loading: !loaded && (AsyncResult.isInitial(refreshResult) || pending),
		notes: notes ?? [],
		pending,
		runFn,
	};
};
