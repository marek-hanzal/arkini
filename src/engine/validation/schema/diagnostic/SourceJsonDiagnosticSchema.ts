import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const SourceJsonDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			DiagnosticCodeEnumSchema.enum.SourceJsonInvalid,
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			DiagnosticSeverityEnumSchema.enum.Error,
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
