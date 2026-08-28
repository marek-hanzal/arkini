import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { importEditorArkpackFileFx } from "~/ui/arkpack/editor/importEditorArkpackFileFx";
import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { RendererRuntime } from "~/renderer/RendererRuntime";

/** Runs one editor arkpack import without letting a later selection cancel an admitted write. */
export const importEditorArkpackFileAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.fn(
			(file: File) =>
				importEditorArkpackFileFx({
					file,
				}).pipe(Effect.provideService(EditorProjectRepository, repository)),
			{
				concurrent: true,
			},
		),
	),
);
