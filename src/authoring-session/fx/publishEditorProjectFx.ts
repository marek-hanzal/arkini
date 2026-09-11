import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { Project } from "~/project-authoring/type/Project";
import { EditorBoardGameResourceOwnerAtom } from "~/editor-board/atom/EditorBoardGameResourceOwnerAtom";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";

export namespace publishEditorProjectFx {
	export type BoardMode = "advance-noop" | "rebuild";
}

const publishEditorBoardGameFx = Effect.fn("publishEditorBoardGameFx")(
	(
		project: Project,
		boardMode: publishEditorProjectFx.BoardMode,
		command: EditorProjectAtom.Command,
	) =>
		Atom.get(EditorBoardGameResourceOwnerAtom).pipe(
			Effect.flatMap((owner) =>
				owner === undefined
					? Effect.void
					: boardMode === "advance-noop" &&
							command.commit !== undefined &&
							project.revision === command.commit.revision
						? owner.advanceNoopFx(project, command.commit.previousRevision)
						: owner.publishFx(project),
			),
		),
);

/** Publishes canonical data, then advances or rebuilds the still-routed Board session. */
export const publishEditorProjectFx = Effect.fn("publishEditorProjectFx")(function* (
	projectId: string,
	command: EditorProjectAtom.Command,
	boardMode: publishEditorProjectFx.BoardMode = "rebuild",
) {
	const projectAtom = EditorProjectAtom(projectId);
	yield* Atom.set(projectAtom, command);
	const project = yield* Atom.get(projectAtom);
	if (project !== undefined) yield* publishEditorBoardGameFx(project, boardMode, command);
});
