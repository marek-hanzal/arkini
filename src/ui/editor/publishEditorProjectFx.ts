import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProject } from "~/editor/EditorProject";
import { EditorBoardGameResourceOwnerAtom } from "~/board-scenario/session/EditorBoardGameResourceOwnerAtom";
import { EditorProjectAtom } from "~/ui/editor/EditorProjectAtom";

const publishEditorBoardGameFx = Effect.fn("publishEditorBoardGameFx")((project: EditorProject) =>
	Atom.get(EditorBoardGameResourceOwnerAtom).pipe(
		Effect.flatMap((owner) => (owner === undefined ? Effect.void : owner.publishFx(project))),
	),
);

/** Publishes canonical data, then refreshes Board only for the still-routed project. */
export const publishEditorProjectFx = Effect.fn("publishEditorProjectFx")(function* (
	projectId: string,
	command: EditorProjectAtom.Command,
) {
	const projectAtom = EditorProjectAtom(projectId);
	yield* Atom.set(projectAtom, command);
	const project = yield* Atom.get(projectAtom);
	if (project !== undefined) yield* publishEditorBoardGameFx(project);
});
