import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { closeEditorProjectMutationLaneFx } from "~/bridge/editor/closeEditorProjectMutationLaneFx";
import { EditorProjectDraftAtom } from "~/bridge/editor/EditorProjectDraftAtom";
import { EditorProjectFormDirtyAtom } from "~/bridge/editor/EditorProjectFormDirtyAtom";

/** Stops canonical writes, drains the lane, then rejects an unresolved local form. */
export const closeEditorProjectSessionFx = Effect.fn("closeEditorProjectSessionFx")(
	(projectId: string) =>
		Effect.gen(function* () {
			yield* closeEditorProjectMutationLaneFx(projectId);
			const formDirty = yield* Atom.get(EditorProjectFormDirtyAtom(projectId));
			const staged = yield* Atom.get(EditorProjectDraftAtom(projectId));
			if (formDirty || Object.keys(staged).length > 0) {
				return yield* Effect.fail(
					new Error("Save or discard the current editor changes before closing."),
				);
			}
		}),
);
