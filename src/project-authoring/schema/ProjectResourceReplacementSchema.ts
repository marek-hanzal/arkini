import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

const identitySchema = z
	.object({
		uid: IdSchema,
		type: ResourceTypeSchema,
		title: z.string().trim().min(1),
	})
	.strict();

export const ProjectResourceFileReplacementSchema = identitySchema.extend({
	path: z.string().min(1),
	size: NonNegativeIntegerSchema,
});

/** Metadata or native file-backed content replacement. */
export const ProjectResourceReplacementSchema = z
	.union([
		ProjectResourceFileReplacementSchema,
		identitySchema,
	])
	.meta({
		id: "ProjectResourceReplacementSchema",
		description: "Resource metadata with optional replacement content.",
	});
export type ProjectResourceReplacementSchema = typeof ProjectResourceReplacementSchema;
export namespace ProjectResourceReplacementSchema {
	export type Type = z.infer<ProjectResourceReplacementSchema>;
}
