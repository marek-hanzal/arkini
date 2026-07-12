import { z } from "zod";

import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const ConfigSchemaDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("config:schema"),
		severity: z.literal("error"),
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
