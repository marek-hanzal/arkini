import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { createFreshEditorProjectFx } from "~/bridge/editor/createFreshEditorProjectFx";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Runs one fresh-project creation without letting navigation cancel an admitted write. */
export const createFreshEditorProjectAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.fn(
			() =>
				createFreshEditorProjectFx().pipe(
					Effect.provideService(EditorProjectRepository, repository),
				),
			{
				concurrent: true,
			},
		),
	),
);
