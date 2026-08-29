import { Effect } from "effect";

import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { createEditorNotesCommandAtomsFx } from "~/project-note/workspace/createEditorNotesCommandAtomsFx";
import { RendererRuntime } from "~/renderer/RendererRuntime";

export const EditorNotesCommandAtoms = RendererRuntime.runSync(
	Effect.flatMap(EditorProjectRepository, createEditorNotesCommandAtomsFx),
);
