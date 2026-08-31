import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { openEditorArkpackFx } from "~/project-authoring/fx/openEditorArkpackFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

/** Keeps an admitted Editor open/import command alive through navigation. */
export const openEditorArkpackAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.fn(
			(packageId: string) =>
				openEditorArkpackFx(packageId).pipe(
					Effect.provideService(ProjectRepository, repository),
				),
			{
				concurrent: true,
			},
		),
	),
);
