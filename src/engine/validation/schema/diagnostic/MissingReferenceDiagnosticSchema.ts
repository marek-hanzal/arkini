import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/engine/validation/schema/DiagnosticRecordEntityEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const MissingReferenceDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract(["ConfigMissingReference"]),
		severity: DiagnosticSeverityEnumSchema.extract(["Error"]),
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
