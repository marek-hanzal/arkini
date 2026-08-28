import type { EditorVersionDescriptorFileSchema } from "~/editor/filesystem/EditorVersionDescriptorFileSchema";
import type { EditorVersionHeadFileSchema } from "~/editor/filesystem/EditorVersionHeadFileSchema";
import type { EditorVersionManifestSchema } from "~/editor/filesystem/EditorVersionManifestSchema";

export interface FilesystemEditorPublishedVersion {
	readonly descriptor: EditorVersionDescriptorFileSchema.Type;
	readonly manifest: EditorVersionManifestSchema.Type;
}

/** Published version metadata captured only when a project opens or explicitly refreshes. */
export interface FilesystemEditorProjectVersionHistory {
	readonly head?: EditorVersionHeadFileSchema.Type;
	readonly versions: ReadonlyMap<string, FilesystemEditorPublishedVersion>;
}
