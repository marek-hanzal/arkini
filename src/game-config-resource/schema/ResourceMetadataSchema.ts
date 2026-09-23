import { z } from "zod";

/** Editor-only resource metadata. The paired filename owns identity; Serapacks omit this file. */
export const ResourceMetadataSchema = z
	.object({
		title: z.string().trim().min(1, "Title is required."),
	})
	.strict()
	.meta({
		id: "ResourceMetadataSchema",
		description: "Editor-only display title for one resource.",
	});

export type ResourceMetadataSchema = typeof ResourceMetadataSchema;

export namespace ResourceMetadataSchema {
	export type Type = z.infer<ResourceMetadataSchema>;
}
