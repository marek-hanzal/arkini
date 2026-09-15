import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

/** A disk-backed typed Resource reference; binary bodies are not part of project state. */
export const ProjectResourceSchema = z
	.object({
		id: IdSchema,
		type: ResourceTypeSchema,
		size: z.number().int().nonnegative(),
		version: z.string().min(1),
	})
	.strict();

export type ProjectResourceSchema = typeof ProjectResourceSchema;
export namespace ProjectResourceSchema {
	export type Type = z.infer<ProjectResourceSchema>;
}
