import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProject } from "~/editor/EditorProject";
import { EditorBoardGameResourceOwnerAtom } from "~/renderer/editor/board/EditorBoardGameResourceOwnerAtom";

/** Synchronizes a committed project only while its editor route still owns Board. */
export const publishEditorBoardGameFx = Effect.fn("publishEditorBoardGameFx")(
	(project: EditorProject) =>
		Atom.get(EditorBoardGameResourceOwnerAtom).pipe(
			Effect.flatMap((owner) =>
				owner === undefined ? Effect.void : owner.publishFx(project),
			),
		),
);
