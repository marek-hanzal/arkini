import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { createFreshEditorProjectFx } from "~/editor/project/fx/createFreshEditorProjectFx";
import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { RendererRuntime } from "~/renderer/RendererRuntime";

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
