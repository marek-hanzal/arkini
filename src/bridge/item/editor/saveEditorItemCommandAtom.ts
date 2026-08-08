import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { saveEditorItemFx } from "~/bridge/item/editor/saveEditorItemFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Owns one exact project's explicit item Save lifecycle. */
export const saveEditorItemCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((item: saveEditorItemFx.Props["item"]) =>
				saveEditorItemFx({
					item,
					projectId,
				}).pipe(Effect.provideService(EditorProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);
