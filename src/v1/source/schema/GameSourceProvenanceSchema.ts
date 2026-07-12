import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { SchemaReferenceProviderSchema } from "./SchemaReferenceProviderSchema";

export const GameSourceProvenanceSchema = z
	.object({
		schema: SchemaReferenceProviderSchema.optional(),
		meta: z.string().min(1).optional(),
		resources: z.string().min(1).optional(),
		start: z.string().min(1).optional(),
		version: z.string().min(1).optional(),
		categories: z.record(IdSchema, z.string().min(1)),
		items: z.record(IdSchema, z.string().min(1)),
	})
	.strict()
	.meta({
		id: "GameSourceProvenanceSchema",
		description: "The source path that first provided each completed game field and record.",
	});

export type GameSourceProvenanceSchema = typeof GameSourceProvenanceSchema;

export namespace GameSourceProvenanceSchema {
	export type Type = z.infer<GameSourceProvenanceSchema>;
}
