import * as Atom from "effect/unstable/reactivity/Atom";

import { persistEditorProjectMutationFx } from "~/bridge/editor/persistEditorProjectMutation";

/** Owns the explicit project Save command for the lifetime of the editor shell. */
export const persistEditorProjectCommandAtom = Atom.family((projectId: string) =>
	Atom.fn(() => persistEditorProjectMutationFx(projectId)).pipe(
		Atom.withLabel(`EditorProjectPersist:${projectId}`),
		Atom.setIdleTTL(0),
	),
);
