import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const ConfigSchemaDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			DiagnosticCodeEnumSchema.enum.ConfigSchema,
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			DiagnosticSeverityEnumSchema.enum.Error,
		]),
		issueCode: z.string().min(1),
	})
	.strict()
	.meta({
		id: "ConfigSchemaDiagnosticSchema",
		description: "The assembled game object violates the completed config schema.",
	});

export type ConfigSchemaDiagnosticSchema = typeof ConfigSchemaDiagnosticSchema;

export namespace ConfigSchemaDiagnosticSchema {
	export type Type = z.infer<ConfigSchemaDiagnosticSchema>;
}
