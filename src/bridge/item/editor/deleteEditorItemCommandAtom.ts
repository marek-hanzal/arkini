import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { deleteEditorItemFx } from "~/bridge/item/editor/deleteEditorItemFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Owns one project's explicit item-delete lifecycle. */
export const deleteEditorItemCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: Omit<deleteEditorItemFx.Props, "projectId">) =>
				deleteEditorItemFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(EditorProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);
