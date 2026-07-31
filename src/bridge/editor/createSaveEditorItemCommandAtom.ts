import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { saveEditorItemMutation } from "~/bridge/editor/saveEditorItemMutation";
import { saveEditorItemMutationFx } from "~/bridge/editor/saveEditorItemMutation";

/** Creates one mounted item-form save command and its exact Effect result state. */
export const createSaveEditorItemCommandAtom = (label: string) =>
	Atom.fn((variables: saveEditorItemMutation.Variables) =>
		saveEditorItemMutationFx(variables).pipe(Effect.map((result) => result.item)),
	).pipe(Atom.withLabel(label), Atom.setIdleTTL(0));
