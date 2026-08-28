import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { openEditorArkpackFx } from "~/bridge/arkpack/editor/openEditorArkpackFx";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Keeps an admitted Editor open/import command alive through navigation. */
export const openEditorArkpackAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.fn(
			(packageId: string) =>
				openEditorArkpackFx(packageId).pipe(
					Effect.provideService(EditorProjectRepository, repository),
				),
			{
				concurrent: true,
			},
		),
	),
);
