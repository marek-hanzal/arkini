import * as Atom from "effect/unstable/reactivity/Atom";

import { importEditorJsonDirectoryFx } from "~/bridge/editor/importEditorJsonDirectoryFx";

/** Keeps one admitted JSON directory import alive across the welcome navigation boundary. */
export const importEditorJsonDirectoryAtom = Atom.fn(() => importEditorJsonDirectoryFx(), {
	concurrent: true,
});
