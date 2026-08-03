import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { replaceEditorItemLineFx } from "~/bridge/item/editor/replaceEditorItemLineFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Owns one exact project's explicit inline line-replace lifecycle. */
export const replaceEditorItemLineCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: Omit<replaceEditorItemLineFx.Props, "projectId">) =>
				replaceEditorItemLineFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(EditorProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);
