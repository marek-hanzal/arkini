import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { EditorBoardGameResourceOwnerAtom } from "~/board-scenario/atom/EditorBoardGameResourceOwnerAtom";

/** Claims and synchronizes the project currently owned by the editor route. */
export const syncEditorBoardGameFx = Effect.fn("syncEditorBoardGameFx")((project: EditorProject) =>
	Atom.get(EditorBoardGameResourceOwnerAtom).pipe(
		Effect.flatMap((owner) => (owner === undefined ? Effect.void : owner.syncFx(project))),
	),
);
