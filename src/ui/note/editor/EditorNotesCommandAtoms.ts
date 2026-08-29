import { Effect } from "effect";

import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { createEditorNotesCommandAtomsFx } from "~/ui/note/editor/createEditorNotesCommandAtomsFx";
import { RendererRuntime } from "~/renderer/RendererRuntime";

export const EditorNotesCommandAtoms = RendererRuntime.runSync(
	Effect.flatMap(EditorProjectRepository, createEditorNotesCommandAtomsFx),
);
