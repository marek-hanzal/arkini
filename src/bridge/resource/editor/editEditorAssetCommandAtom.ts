import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { editEditorAssetFx } from "~/bridge/resource/editor/editEditorAssetFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Owns the explicit asset Edit submission lifecycle. */
export const editEditorAssetCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.fn((props: editEditorAssetFx.Props) =>
			editEditorAssetFx(props).pipe(
				Effect.provideService(EditorProjectRepository, repository),
			),
		),
	),
);
