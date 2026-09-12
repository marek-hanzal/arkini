import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";

/** A disk-backed Editor asset reference; PNG bodies are not part of project state. */
export const ProjectResourceSchema = z
	.object({
		id: IdSchema,
		mime: z.literal("image/png"),
		size: z.number().int().nonnegative(),
		version: z.string().min(1),
	})
	.strict();

export type ProjectResourceSchema = typeof ProjectResourceSchema;
export namespace ProjectResourceSchema {
	export type Type = z.infer<ProjectResourceSchema>;
}
