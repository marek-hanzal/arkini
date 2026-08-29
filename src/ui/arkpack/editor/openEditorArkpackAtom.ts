import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { openEditorArkpackFx } from "~/ui/arkpack/editor/openEditorArkpackFx";
import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { RendererRuntime } from "~/renderer/RendererRuntime";

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
