import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorBoardGameResourceOwnerAtom } from "~/renderer/editor/board/EditorBoardGameResourceOwnerAtom";

/** React projection of the process-owned editor-game lifecycle state. */
export const EditorBoardGameAtom = Atom.subscriptionRef((get) => {
	const owner = get(EditorBoardGameResourceOwnerAtom);
	if (owner === undefined) throw new Error("Editor Board game owner is not configured.");
	return owner.state;
}).pipe(Atom.keepAlive);
