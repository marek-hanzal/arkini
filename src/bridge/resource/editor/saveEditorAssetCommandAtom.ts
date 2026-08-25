import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { saveEditorAssetFx } from "~/bridge/resource/editor/saveEditorAssetFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Owns one explicit single-asset save lifecycle per editor project. */
export const saveEditorAssetCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: Omit<saveEditorAssetFx.Props, "projectId">) =>
				saveEditorAssetFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(EditorProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);
