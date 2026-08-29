import { z } from "zod";

export const SchemaReferenceProviderSchema = z
	.object({
		path: z.string().min(1),
		value: z.string().min(1),
		resolved: z.string().min(1),
	})
	.strict()
	.meta({
		id: "SchemaReferenceProviderSchema",
		description: "The source path and value of the canonical JSON Schema reference.",
	});

export type SchemaReferenceProviderSchema = typeof SchemaReferenceProviderSchema;

export namespace SchemaReferenceProviderSchema {
	export type Type = z.infer<SchemaReferenceProviderSchema>;
}
