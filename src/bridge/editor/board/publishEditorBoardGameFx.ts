import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorBoardGameResourceOwnerAtom } from "~/bridge/editor/board/EditorBoardGameResource";

/** Synchronizes a committed project only while its editor route still owns Board. */
export const publishEditorBoardGameFx = Effect.fn("publishEditorBoardGameFx")(
	(project: EditorProject) =>
		Atom.get(EditorBoardGameResourceOwnerAtom).pipe(
			Effect.flatMap((owner) =>
				owner === undefined ? Effect.void : owner.publishFx(project),
			),
		),
);
