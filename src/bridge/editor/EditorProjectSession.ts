import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectFormDirtyAtom } from "~/bridge/editor/EditorProjectFormDirtyAtom";
import {
	closeEditorProjectMutationLaneFx,
	openEditorProjectMutationLane,
	releaseEditorProjectMutationLane,
	resumeEditorProjectMutationLane,
} from "~/bridge/editor/EditorProjectMutationLane";

let activeProjectId: string | undefined;

export const openEditorProjectSession = (projectId: string) => {
	openEditorProjectMutationLane(projectId);
	activeProjectId = projectId;
};

/** Reopens admission after a failed close. */
export const resumeEditorProjectSession = (projectId: string) => {
	resumeEditorProjectMutationLane(projectId);
	activeProjectId = projectId;
};

/** Stops admission, drains canonical writes, then rejects an unresolved local form. */
export const closeEditorProjectSessionFx = Effect.fn("closeEditorProjectSessionFx")(
	(projectId: string) =>
		Effect.gen(function* () {
			yield* closeEditorProjectMutationLaneFx(projectId);
			const formDirty = yield* Atom.get(EditorProjectFormDirtyAtom(projectId));
			if (formDirty) {
				return yield* Effect.fail(
					new Error("Save or discard the current form before closing the editor."),
				);
			}
		}),
);

export const closeActiveEditorProjectSessionFx = Effect.suspend(() => {
	const projectId = activeProjectId;
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
	releaseEditorProjectMutationLane(projectId);
	if (activeProjectId === projectId) activeProjectId = undefined;
};
