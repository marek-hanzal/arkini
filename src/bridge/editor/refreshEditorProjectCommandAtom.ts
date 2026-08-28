import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { EditorUnsavedChanges } from "~/bridge/editor/EditorUnsavedChanges";
import { refreshEditorProjectFx } from "~/bridge/editor/refreshEditorProjectFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Runs at most one hard filesystem refresh for each mounted editor project. */
export const refreshEditorProjectCommandAtom = RendererRuntime.runSync(
	Effect.gen(function* () {
		const repository = yield* EditorProjectRepository;
		const unsavedChanges = yield* EditorUnsavedChanges;
		return Atom.family((projectId: string) =>
			Atom.fn(
				() =>
					refreshEditorProjectFx({
						projectId,
					}).pipe(
						Effect.provideService(EditorProjectRepository, repository),
						Effect.provideService(EditorUnsavedChanges, unsavedChanges),
					),
				{
					concurrent: false,
				},
			).pipe(Atom.setIdleTTL(0)),
		);
	}),
);
