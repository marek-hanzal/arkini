import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { saveEditorAssetFx } from "~/bridge/resource/editor/saveEditorAssetFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Owns the mounted asset-library write command and its exact Effect result state. */
export const saveEditorAssetCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.fn((variables: saveEditorAssetFx.Props) =>
			saveEditorAssetFx(variables).pipe(
				Effect.provideService(EditorProjectRepository, repository),
			),
		).pipe(Atom.withLabel("EditorAssetSave"), Atom.setIdleTTL(0)),
	),
);
