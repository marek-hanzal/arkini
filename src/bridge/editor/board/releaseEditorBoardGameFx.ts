import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorBoardGameResourceOwnerAtom } from "~/bridge/editor/board/EditorBoardGameResource";

/** Releases the editor game only when the routed project still owns it. */
export const releaseEditorBoardGameFx = Effect.fn("releaseEditorBoardGameFx")((projectId: string) =>
	Atom.get(EditorBoardGameResourceOwnerAtom).pipe(
		Effect.flatMap((owner) => (owner === undefined ? Effect.void : owner.releaseFx(projectId))),
	),
);
