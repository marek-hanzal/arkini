import * as Atom from "effect/unstable/reactivity/Atom";

import { openEditorDirectoryFx } from "~/bridge/editor/openEditorDirectoryFx";

/** Opens one editor directory through the trusted preload transport. */
export const openEditorDirectoryAtom = Atom.fn(
	(projectId?: string) => openEditorDirectoryFx(projectId),
	{
		concurrent: true,
	},
);
