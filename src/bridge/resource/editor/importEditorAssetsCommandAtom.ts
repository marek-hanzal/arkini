import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { importEditorArkpackAssetsFx } from "~/bridge/arkpack/editor/importEditorArkpackAssetsFx";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { saveEditorAssetsFx } from "~/bridge/resource/editor/saveEditorAssetsFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

export namespace importEditorAssetsCommandAtom {
	export type Props =
		| (saveEditorAssetsFx.Props & {
				readonly source: "files";
		  })
		| (importEditorArkpackAssetsFx.Props & {
				readonly source: "arkpack";
		  });
}

/** Owns both asset import sources so only one canonical project write is pending at a time. */
export const importEditorAssetsCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.fn((variables: importEditorAssetsCommandAtom.Props) =>
			(variables.source === "arkpack"
				? importEditorArkpackAssetsFx(variables)
				: saveEditorAssetsFx(variables)
			).pipe(Effect.provideService(EditorProjectRepository, repository)),
		).pipe(Atom.withLabel("EditorAssetsImport"), Atom.setIdleTTL(0)),
	),
);
