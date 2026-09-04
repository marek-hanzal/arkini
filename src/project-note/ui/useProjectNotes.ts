import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useEffect } from "react";

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
	const commandAtom = NoteCommandAtoms.commandFn(projectId);
	const streamAtom = NoteCommandAtoms.streamFn(projectId);
	const commandResult = useAtomValue(commandAtom);
	const notes = useAtomValue(streamAtom);
	const runFn = useAtomSet(commandAtom, {
		mode: "promise",
	});

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
	useEffect(
		() =>
			window.arkini.editor.onProjectChangedFn((changedProjectId) => {
				if (changedProjectId !== projectId) return;
				void runFn({
					action: "load",
				}).catch(() => undefined);
			}),
		[
			projectId,
			runFn,
		],
	);

	const loaded = notes !== undefined;
	const error = RendererRuntime.runSync(readSettledAsyncResultErrorFx(commandResult));
	return {
		...(error === undefined
			? {}
			: {
					error,
				}),
		loaded,
		loading: !loaded && (AsyncResult.isInitial(commandResult) || commandResult.waiting),
		notes: notes ?? [],
		pending: commandResult.waiting,
		runFn,
	};
};
