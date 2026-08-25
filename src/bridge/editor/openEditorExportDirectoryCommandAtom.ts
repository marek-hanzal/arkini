import * as Atom from "effect/unstable/reactivity/Atom";

import { openEditorExportDirectoryFx } from "~/bridge/editor/openEditorExportDirectoryFx";

/** Owns one request to reveal a successful source export in the OS file browser. */
export const openEditorExportDirectoryCommandAtom = Atom.fn(() =>
	openEditorExportDirectoryFx(),
).pipe(Atom.setIdleTTL(0));
