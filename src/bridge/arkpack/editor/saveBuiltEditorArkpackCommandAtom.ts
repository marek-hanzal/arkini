import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { buildEditorProjectFx } from "~/bridge/arkpack/editor/buildEditorProjectFx";
import { saveBuiltEditorArkpackFx } from "~/bridge/arkpack/editor/saveBuiltEditorArkpackFx";

/** Owns browser-style Save As state for one exact build artifact hash. */
export const saveBuiltEditorArkpackCommandAtom = Atom.family((contentHash: string) =>
	Atom.fn((artifact: buildEditorProjectFx.Success) =>
		artifact.contentHash === contentHash
			? saveBuiltEditorArkpackFx(artifact)
			: Effect.fail(new Error("The selected editor build artifact is stale.")),
	).pipe(Atom.setIdleTTL(0)),
);
