import * as Atom from "effect/unstable/reactivity/Atom";

import type { saveEditorAssetMutation } from "~/bridge/editor/saveEditorAssetMutation";
import { saveEditorAssetMutationFx } from "~/bridge/editor/saveEditorAssetMutation";

/** Owns the mounted asset-library write command and its exact Effect result state. */
export const saveEditorAssetCommandAtom = Atom.fn(
	(variables: saveEditorAssetMutation.Variables) => saveEditorAssetMutationFx(variables),
).pipe(Atom.withLabel("EditorAssetSave"), Atom.setIdleTTL(0));
