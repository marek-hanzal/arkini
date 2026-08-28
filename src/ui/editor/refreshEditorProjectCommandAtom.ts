import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { refreshEditorProjectFx } from "~/ui/editor/refreshEditorProjectFx";
import { EditorUnsavedChanges } from "~/renderer/editor/unsaved/EditorUnsavedChanges";
import { RendererRuntime } from "~/renderer/RendererRuntime";

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
