import { Layer } from "effect";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import {
	createIndexedDbEditorProjectRepositoryFx,
	type createIndexedDbEditorProjectRepositoryFx as CreateIndexedDbEditorProjectRepositoryFx,
} from "~/bridge/editor/createIndexedDbEditorProjectRepositoryFx";

/** Owns one scoped IndexedDB editor-project repository for a renderer runtime. */
export const EditorProjectRepositoryLayer = (
	props: CreateIndexedDbEditorProjectRepositoryFx.Props = {},
) => Layer.effect(EditorProjectRepository, createIndexedDbEditorProjectRepositoryFx(props));
