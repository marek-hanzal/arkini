import { z } from "zod";

import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const SourceSchemaDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("source:schema-invalid"),
		severity: z.literal("error"),
		issueCode: z.string().min(1),
	})
	.strict()
	.meta({
		id: "SourceSchemaDiagnosticSchema",
		description: "One parsed JSON source violates the game-fragment schema.",
	});

export type SourceSchemaDiagnosticSchema = typeof SourceSchemaDiagnosticSchema;

export namespace SourceSchemaDiagnosticSchema {
	export type Type = z.infer<SourceSchemaDiagnosticSchema>;
}
