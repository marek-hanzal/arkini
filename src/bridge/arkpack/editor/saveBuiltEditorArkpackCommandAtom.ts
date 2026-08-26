import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { saveBuiltEditorArkpackFx } from "~/bridge/arkpack/editor/saveBuiltEditorArkpackFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorProjectBuildSchema } from "~/editor/EditorProjectBuildSchema";

/** Saves the exact current canonical build and optional signature through Electron main. */
export const saveBuiltEditorArkpackCommandAtom = RendererRuntime.runSync(
	Effect.succeed(
		Atom.family((contentHash: string) =>
			Atom.fn((artifact: EditorProjectBuildSchema.Type) =>
				artifact.contentHash !== contentHash
					? Effect.fail(new Error("The selected editor build artifact is stale."))
					: saveBuiltEditorArkpackFx(artifact),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);
