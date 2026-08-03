import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { appendEditorItemLineFx } from "~/bridge/item/editor/appendEditorItemLineFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Owns one exact project's explicit inline line-append lifecycle. */
export const appendEditorItemLineCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: Omit<appendEditorItemLineFx.Props, "projectId">) =>
				appendEditorItemLineFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(EditorProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);
