import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const SourceSchemaDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			DiagnosticSeverityEnumSchema.enum.Error,
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
