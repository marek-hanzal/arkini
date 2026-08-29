import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorUnsavedChangesService } from "~/authoring-session/EditorUnsavedChanges";

/** Configured process owner for mounted editor drafts and their leave decision. */
export const EditorUnsavedChangesOwnerAtom = Atom.make<EditorUnsavedChangesService | undefined>(
	undefined,
).pipe(Atom.keepAlive);
