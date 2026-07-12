import { z } from "zod";

import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const SchemaReferenceConflictDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("source:schema-reference-conflict"),
		severity: z.literal("error"),
		values: z.tuple([
			z.string().min(1),
			z.string().min(1),
		]),
		sources: z.tuple([
			z.string().min(1),
			z.string().min(1),
		]),
	})
	.strict()
	.meta({
		id: "SchemaReferenceConflictDiagnosticSchema",
		description: "Source fragments declare incompatible JSON Schema references.",
	});

export type SchemaReferenceConflictDiagnosticSchema =
	typeof SchemaReferenceConflictDiagnosticSchema;

export namespace SchemaReferenceConflictDiagnosticSchema {
	export type Type = z.infer<SchemaReferenceConflictDiagnosticSchema>;
}
