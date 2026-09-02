import type { VersionDescriptorFileSchema } from "~/project-version/schema/VersionDescriptorFileSchema";
import type { VersionManifestSchema } from "~/project-version/schema/VersionManifestSchema";

export interface PublishedVersion {
	readonly descriptor: VersionDescriptorFileSchema.Type;
	readonly manifest: VersionManifestSchema.Type;
}
