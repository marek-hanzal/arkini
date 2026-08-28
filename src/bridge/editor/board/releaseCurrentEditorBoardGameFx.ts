import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorBoardGameResourceOwnerAtom } from "~/bridge/editor/board/EditorBoardGameResource";

/** Joins disposal of whichever editor game currently owns the process boundary. */
export const releaseCurrentEditorBoardGameFx = Atom.get(EditorBoardGameResourceOwnerAtom).pipe(
	Effect.flatMap((owner) => (owner === undefined ? Effect.void : owner.releaseCurrentFx)),
	Effect.withSpan("releaseCurrentEditorBoardGameFx"),
);
