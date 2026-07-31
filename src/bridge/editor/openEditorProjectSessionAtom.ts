import * as Atom from "effect/unstable/reactivity/Atom";

import { openEditorProjectSessionFx } from "~/bridge/editor/openEditorProjectSessionFx";

/** Opens or resumes one mounted editor project session through the shared Atom runtime. */
export const openEditorProjectSessionAtom = Atom.fn((projectId: string) =>
	openEditorProjectSessionFx(projectId),
).pipe(Atom.withLabel("EditorProjectOpen"), Atom.setIdleTTL(0));
