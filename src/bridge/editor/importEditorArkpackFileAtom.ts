import * as Atom from "effect/unstable/reactivity/Atom";

import { importEditorArkpackFileFx } from "~/bridge/editor/importEditorArkpackFileFx";

/** Runs one editor arkpack import without letting a later selection cancel an admitted write. */
export const importEditorArkpackFileAtom = Atom.fn(
	(file: File) => importEditorArkpackFileFx({ file }),
	{
		concurrent: true,
	},
);
