import { z } from "zod";

import { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";

const identitySchema = z
	.object({
		id: IdSchema,
		mime: ResourceSchema.shape.mime,
	})
	.strict();

export const ProjectResourceFileReplacementSchema = identitySchema.extend({
	path: z.string().min(1),
	size: NonNegativeIntegerSchema,
});

/** A rename, byte-backed replacement, or native file-backed replacement. */
export const ProjectResourceReplacementSchema = z
	.union([
		ResourceSchema,
		ProjectResourceFileReplacementSchema,
		identitySchema,
	])
	.meta({
		id: "ProjectResourceReplacementSchema",
		description: "An asset rename with optional replacement PNG content.",
	});
export type ProjectResourceReplacementSchema = typeof ProjectResourceReplacementSchema;
export namespace ProjectResourceReplacementSchema {
	export type Type = z.infer<ProjectResourceReplacementSchema>;
}
