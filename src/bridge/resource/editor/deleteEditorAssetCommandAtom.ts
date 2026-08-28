import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { deleteEditorAssetFx } from "~/bridge/resource/editor/deleteEditorAssetFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Owns one project's explicit asset-delete lifecycle. */
export const deleteEditorAssetCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: Omit<deleteEditorAssetFx.Props, "projectId">) =>
				deleteEditorAssetFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(EditorProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);
