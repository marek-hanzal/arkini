import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { buildEditorProjectFx } from "~/bridge/arkpack/editor/buildEditorProjectFx";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Owns one project's explicit heavy validation and immutable Arkpack build. */
export const buildEditorProjectCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn(() =>
				buildEditorProjectFx(projectId).pipe(
					Effect.provideService(EditorProjectRepository, repository),
				),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);
