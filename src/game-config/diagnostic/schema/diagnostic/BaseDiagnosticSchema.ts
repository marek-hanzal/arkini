import { z } from "zod";

import { DiagnosticPathSchema } from "../DiagnosticPathSchema";
import { DiagnosticSeverityEnumSchema } from "../DiagnosticSeverityEnumSchema";

export const BaseDiagnosticSchema = z
	.object({
		severity: DiagnosticSeverityEnumSchema,
		path: DiagnosticPathSchema,
		source: z.string().min(1).optional(),
		message: z.string().min(1),
	})
	.strict()
	.meta({
		id: "BaseDiagnosticSchema",
		description: "Fields shared by every completed-game diagnostic.",
	});

export type BaseDiagnosticSchema = typeof BaseDiagnosticSchema;

export namespace BaseDiagnosticSchema {
	export type Type = z.infer<BaseDiagnosticSchema>;
}
