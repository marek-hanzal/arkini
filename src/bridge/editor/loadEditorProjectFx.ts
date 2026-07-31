import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { readEditorProjectFx } from "~/bridge/editor/readEditorProjectFx";

/** Captures the loader CAS epoch and reads its disk snapshot in one Effect program. */
export const loadEditorProjectFx = Effect.fn("loadEditorProjectFx")(function* ({
	projectId,
}: {
	readonly projectId: string;
}) {
	const expectedRevision = (yield* Atom.get(EditorProjectAtom(projectId)))?.revision;
	const project = yield* readEditorProjectFx({
		projectId,
	});
	return {
		expectedRevision,
		project,
	};
});
