import type { EditorProjectFileSchema } from "~/editor/filesystem/EditorProjectFileSchema";
import type { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Canonical current-tree data backed by one Editor project directory. */
export interface FilesystemEditorProjectFiles {
	readonly marker: EditorProjectFileSchema.Type;
	readonly config: GameConfigSchema.Type;
	readonly resources: ReadonlyArray<ResourceSchema.Type>;
}
