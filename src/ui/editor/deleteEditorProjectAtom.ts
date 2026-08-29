import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { RendererRuntime } from "~/renderer/RendererRuntime";

/** Deletes one editor project through the renderer's canonical repository proxy. */
export const deleteEditorProjectAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.fn((projectId: string) => repository.deleteProjectFx(projectId), {
			concurrent: true,
		}),
	),
);
