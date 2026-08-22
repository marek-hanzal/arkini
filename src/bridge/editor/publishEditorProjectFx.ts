import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { syncEditorBoardGameFx } from "~/bridge/editor/board/syncEditorBoardGameFx";

/** Publishes one canonical project update and serializes its editor-game replacement. */
export const publishEditorProjectFx = Effect.fn("publishEditorProjectFx")(function* (
	projectId: string,
	command: EditorProjectAtom.Command,
) {
	const projectAtom = EditorProjectAtom(projectId);
	yield* Atom.set(projectAtom, command);
	const project = yield* Atom.get(projectAtom);
	if (project !== undefined) yield* syncEditorBoardGameFx(project);
});
