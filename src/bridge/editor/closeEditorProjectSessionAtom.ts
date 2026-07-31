import * as Atom from "effect/unstable/reactivity/Atom";

import { closeEditorProjectSessionFx } from "~/bridge/editor/closeEditorProjectSessionFx";

/** Owns one mounted editor close/drain request without exposing RendererRuntime to React. */
export const closeEditorProjectSessionAtom = Atom.fn((projectId: string) =>
	closeEditorProjectSessionFx(projectId),
).pipe(Atom.withLabel("EditorProjectClose"), Atom.setIdleTTL(0));
