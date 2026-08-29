import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { deleteEditorItemFx } from "~/ui/item/editor/deleteEditorItemFx";
import { RendererRuntime } from "~/renderer/RendererRuntime";

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
