import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticRecordEntityEnumSchema";

import { IdSchema } from "~/game-config/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const MissingReferenceDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"ConfigMissingReference",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
		]),
		reference: DiagnosticRecordEntityEnumSchema,
		referenceId: IdSchema,
	})
	.strict()
	.meta({
		id: "MissingReferenceDiagnosticSchema",
		description: "A completed config references a canonical record that does not exist.",
	});

export type MissingReferenceDiagnosticSchema = typeof MissingReferenceDiagnosticSchema;

export namespace MissingReferenceDiagnosticSchema {
	export type Type = z.infer<MissingReferenceDiagnosticSchema>;
}
