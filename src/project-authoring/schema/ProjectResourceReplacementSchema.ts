import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

const identitySchema = z
	.object({
		id: IdSchema,
		type: ResourceTypeSchema,
	})
	.strict();

export const ProjectResourceFileReplacementSchema = identitySchema.extend({
	path: z.string().min(1),
	size: NonNegativeIntegerSchema,
});

/** A rename or native file-backed replacement. */
export const ProjectResourceReplacementSchema = z
	.union([
		ProjectResourceFileReplacementSchema,
		identitySchema,
	])
	.meta({
		id: "ProjectResourceReplacementSchema",
		description: "A resource rename with optional replacement content.",
	});
export type ProjectResourceReplacementSchema = typeof ProjectResourceReplacementSchema;
export namespace ProjectResourceReplacementSchema {
	export type Type = z.infer<ProjectResourceReplacementSchema>;
}
