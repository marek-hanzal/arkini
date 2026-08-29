import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { saveEditorProjectConfigFx } from "~/ui/project/editor/saveEditorProjectConfigFx";
import { RendererRuntime } from "~/renderer/RendererRuntime";

/** Owns one exact project's explicit complete-config Save lifecycle. */
export const saveEditorProjectConfigCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: Omit<saveEditorProjectConfigFx.Props, "projectId">) =>
				saveEditorProjectConfigFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(EditorProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);
