import * as Atom from "effect/unstable/reactivity/Atom";

import { releaseEditorProjectSessionFx } from "~/bridge/editor/releaseEditorProjectSessionFx";

/** Releases one closed editor project session through the shared Atom runtime. */
export const releaseEditorProjectSessionAtom = Atom.fn((projectId: string) =>
	releaseEditorProjectSessionFx(projectId),
).pipe(Atom.withLabel("EditorProjectRelease"), Atom.setIdleTTL(0));
