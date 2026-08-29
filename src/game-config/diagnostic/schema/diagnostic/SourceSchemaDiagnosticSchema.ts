import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticSeverityEnumSchema";

import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const SourceSchemaDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"SourceSchemaInvalid",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
		]),
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
