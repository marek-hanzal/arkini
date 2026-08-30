import type { EditorVersionDescriptorFileSchema } from "~/project-version/schema/EditorVersionDescriptorFileSchema";
import type { EditorVersionManifestSchema } from "~/project-version/schema/EditorVersionManifestSchema";

export interface PublishedVersion {
	readonly descriptor: EditorVersionDescriptorFileSchema.Type;
	readonly manifest: EditorVersionManifestSchema.Type;
}
