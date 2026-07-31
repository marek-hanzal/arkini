import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";

import { EditorProjectDraftAtom } from "~/bridge/editor/EditorProjectDraftAtom";
import { EditorProjectFormDirtyAtom } from "~/bridge/editor/EditorProjectFormDirtyAtom";
import {
	beginEditorProjectCanonicalClose,
	openEditorProjectSession as openSessionState,
	readActiveEditorProjectId,
	readEditorProjectSessionFailure,
	releaseEditorProjectSession as releaseSessionState,
	resumeEditorProjectSession as resumeSessionState,
} from "~/bridge/editor/EditorProjectSessionState";

export const openEditorProjectSession = (
	projectId: string,
	registry: AtomRegistry.AtomRegistry,
) => {
	openSessionState(projectId, () => registry.mount(EditorProjectDraftAtom(projectId)));
};

/** Reopens admission after a failed close without forgetting the failure being retried. */
export const resumeEditorProjectSession = (projectId: string) => {
	resumeSessionState(projectId);
};

/** Stops admission and drains every canonical and recovery mutation for one project. */
export const closeEditorProjectSessionFx = Effect.fn("closeEditorProjectSessionFx")(
	(projectId: string) =>
		Effect.gen(function* () {
			yield* beginEditorProjectCanonicalClose(projectId);
			const formDirty = yield* Atom.get(EditorProjectFormDirtyAtom(projectId));
			const staged = yield* Atom.get(EditorProjectDraftAtom(projectId));
			if (formDirty || Object.keys(staged).length > 0) {
				return yield* Effect.fail(
					new Error("Save the current item before closing the editor."),
				);
			}
			const failure = readEditorProjectSessionFailure(projectId);
			if (failure !== undefined) return yield* Effect.fail(failure);
		}),
);

export const closeActiveEditorProjectSessionFx = Effect.suspend(() => {
	const projectId = readActiveEditorProjectId();
	return projectId === undefined
		? Effect.void
		: closeEditorProjectSessionFx(projectId).pipe(
				Effect.tapError(() =>
					Effect.sync(() => {
						resumeEditorProjectSession(projectId);
					}),
				),
			);
});

export const releaseEditorProjectSession = (projectId: string) => {
	releaseSessionState(projectId);
};
