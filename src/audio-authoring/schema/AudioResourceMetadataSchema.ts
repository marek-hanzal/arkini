import { z } from "zod";

/** Editor-only audio metadata. The paired filename owns identity; Serapacks omit this file. */
export const AudioResourceMetadataSchema = z
	.object({
		name: z.string().trim().min(1, "Name is required."),
	})
	.strict()
	.meta({
		id: "AudioResourceMetadataSchema",
		description: "Editor-only display name for one Music or SFX resource.",
	});

export type AudioResourceMetadataSchema = typeof AudioResourceMetadataSchema;

export namespace AudioResourceMetadataSchema {
	export type Type = z.infer<AudioResourceMetadataSchema>;
}
