import { Effect } from "effect";

import { EditorProjectRepository } from "~/project-authoring/repository/EditorProjectRepository";
import { createEditorNotesCommandAtomsFx } from "~/project-note/workspace/createEditorNotesCommandAtomsFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

export const EditorNotesCommandAtoms = RendererRuntime.runSync(
	Effect.flatMap(EditorProjectRepository, createEditorNotesCommandAtomsFx),
);
