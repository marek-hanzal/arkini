import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/engine/validation/schema/DiagnosticRecordEntityEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const DuplicateRecordDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"SourceDuplicateRecord",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
		]),
		entity: DiagnosticRecordEntityEnumSchema,
		key: IdSchema,
		sources: z.tuple([
			z.string().min(1),
			z.string().min(1),
		]),
	})
	.strict()
	.meta({
		id: "DuplicateRecordDiagnosticSchema",
		description: "Two source fragments provide the same canonical record key.",
	});

export type DuplicateRecordDiagnosticSchema = typeof DuplicateRecordDiagnosticSchema;

export namespace DuplicateRecordDiagnosticSchema {
	export type Type = z.infer<DuplicateRecordDiagnosticSchema>;
}
