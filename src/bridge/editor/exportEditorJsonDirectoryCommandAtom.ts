import * as Atom from "effect/unstable/reactivity/Atom";

import { exportEditorJsonDirectoryFx } from "~/bridge/editor/exportEditorJsonDirectoryFx";

/** Owns one explicit new-folder source export for a canonical editor project. */
export const exportEditorJsonDirectoryCommandAtom = Atom.family((projectId: string) =>
	Atom.fn(() => exportEditorJsonDirectoryFx(projectId)).pipe(Atom.setIdleTTL(0)),
);
