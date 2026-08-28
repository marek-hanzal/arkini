import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorProjectRepository as EditorProjectRepositoryContract } from "~/editor/EditorProjectRepository";

/** Owns one project's explicit heavy validation and immutable Arkpack build. */
export const buildEditorProjectCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn(
				(request: Omit<EditorProjectRepositoryContract.BuildProjectProps, "projectId">) =>
					repository.buildProjectFx({
						...request,
						projectId,
					}),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);
