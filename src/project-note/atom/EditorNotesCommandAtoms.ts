import { Effect } from "effect";

import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import { createEditorNotesCommandAtomsFx } from "~/project-note/fx/createEditorNotesCommandAtomsFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

export const EditorNotesCommandAtoms = RendererRuntime.runSync(
	Effect.flatMap(EditorProjectRepository, createEditorNotesCommandAtomsFx),
);
