import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { readEditorProjectFx } from "~/bridge/editor/readEditorProjectFx";

/** Loads the project once, then reuses the canonical in-memory editor index. */
export const loadEditorProjectFx = Effect.fn("loadEditorProjectFx")(function* ({
	projectId,
}: {
	readonly projectId: string;
}) {
	const current = yield* Atom.get(EditorProjectAtom(projectId));
	if (current !== undefined) {
		return {
			expectedRevision: current.revision,
			project: current,
		};
	}
	return {
		expectedRevision: undefined,
		project: yield* readEditorProjectFx({
			projectId,
		}),
	};
});
