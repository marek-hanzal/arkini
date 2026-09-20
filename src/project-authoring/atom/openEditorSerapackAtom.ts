import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { openEditorSerapackFx } from "~/project-authoring/fx/openEditorSerapackFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

/** Keeps an admitted Editor open/import command alive through navigation. */
export const openEditorSerapackAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.fn(
			(packageId: string) =>
				openEditorSerapackFx(packageId).pipe(
					Effect.provideService(ProjectRepository, repository),
				),
			{
				concurrent: true,
			},
		),
	),
);
