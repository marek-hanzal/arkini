import { z } from "zod";

export const DiagnosticSeverityEnumSchema = z
	.enum({
		Error: "error",
		Warning: "warning",
	})
	.meta({
		id: "DiagnosticSeverityEnumSchema",
		description: "The severity of one completed-game validation diagnostic.",
	});

export type DiagnosticSeverityEnumSchema = typeof DiagnosticSeverityEnumSchema;

export namespace DiagnosticSeverityEnumSchema {
	export type Type = z.infer<DiagnosticSeverityEnumSchema>;
}
