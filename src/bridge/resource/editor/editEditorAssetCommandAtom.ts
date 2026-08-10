import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { editEditorAssetFx } from "~/bridge/resource/editor/editEditorAssetFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Owns the explicit asset Edit submission lifecycle. */
export const editEditorAssetCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: Omit<editEditorAssetFx.Props, "projectId">) =>
				editEditorAssetFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(EditorProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);
