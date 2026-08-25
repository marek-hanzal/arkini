import { Effect } from "effect";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { createEditorNotesCommandAtomsFx } from "~/bridge/editor/note/createEditorNotesCommandAtomsFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

export const EditorNotesCommandAtoms = RendererRuntime.runSync(
	Effect.flatMap(EditorProjectRepository, createEditorNotesCommandAtomsFx),
);
