import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticSeverityEnumSchema";

import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const SourceJsonDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"SourceJsonInvalid",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
		]),
	})
	.strict()
	.meta({
		id: "SourceJsonDiagnosticSchema",
		description: "One game source file contains invalid JSON syntax.",
	});

export type SourceJsonDiagnosticSchema = typeof SourceJsonDiagnosticSchema;

export namespace SourceJsonDiagnosticSchema {
	export type Type = z.infer<SourceJsonDiagnosticSchema>;
}
