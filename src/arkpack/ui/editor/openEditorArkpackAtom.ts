import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { openEditorArkpackFx } from "~/arkpack/ui/editor/openEditorArkpackFx";
import { EditorProjectRepository } from "~/project-authoring/repository/EditorProjectRepository";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

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
