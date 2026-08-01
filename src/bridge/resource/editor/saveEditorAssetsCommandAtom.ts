import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { saveEditorAssetsFx } from "~/bridge/resource/editor/saveEditorAssetsFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Owns the mounted asset-library write command and its exact Effect result state. */
export const saveEditorAssetsCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.fn((variables: saveEditorAssetsFx.Props) =>
			saveEditorAssetsFx(variables).pipe(
				Effect.provideService(EditorProjectRepository, repository),
			),
		).pipe(Atom.withLabel("EditorAssetsSave"), Atom.setIdleTTL(0)),
	),
);
