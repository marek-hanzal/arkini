import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorBoardGameResource } from "~/editor-board/service/EditorBoardGameResource";

/** Configured process owner used by renderer commands and the React projection. */
export const EditorBoardGameResourceOwnerAtom = Atom.make<EditorBoardGameResource | undefined>(
	undefined,
).pipe(Atom.keepAlive);
