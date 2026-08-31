import { Effect } from "effect";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { createNoteCommandAtomsFx } from "~/project-note/fx/createNoteCommandAtomsFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

export const NoteCommandAtoms = RendererRuntime.runSync(
	Effect.flatMap(ProjectRepository, createNoteCommandAtomsFx),
);
