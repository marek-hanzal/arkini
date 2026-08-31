import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { openEditorArkpackFx } from "~/project-authoring/fx/openEditorArkpackFx";
import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
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
