import { Layer } from "effect";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { createElectronEditorProjectRepositoryFx } from "~/bridge/editor/createElectronEditorProjectRepositoryFx";

/** Owns one infallible IPC proxy to the main-process editor repository. */
export const EditorProjectRepositoryLayer = () =>
	Layer.effect(EditorProjectRepository, createElectronEditorProjectRepositoryFx);
