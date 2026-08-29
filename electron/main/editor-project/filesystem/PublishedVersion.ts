import type { EditorVersionDescriptorFileSchema } from "~/project-version/EditorVersionDescriptorFileSchema";
import type { EditorVersionManifestSchema } from "~/project-version/EditorVersionManifestSchema";

export interface PublishedVersion {
	readonly descriptor: EditorVersionDescriptorFileSchema.Type;
	readonly manifest: EditorVersionManifestSchema.Type;
}
