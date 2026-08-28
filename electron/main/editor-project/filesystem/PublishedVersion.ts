import type { EditorVersionDescriptorFileSchema } from "~/editor/filesystem/EditorVersionDescriptorFileSchema";
import type { EditorVersionManifestSchema } from "~/editor/filesystem/EditorVersionManifestSchema";

export interface PublishedVersion {
	readonly descriptor: EditorVersionDescriptorFileSchema.Type;
	readonly manifest: EditorVersionManifestSchema.Type;
}
