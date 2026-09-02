import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { DiagnosticPathSchema } from "./DiagnosticPathSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const DuplicateLineIdDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"LineDuplicateId",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
		]),
		ownerItemId: IdSchema,
		lineId: IdSchema,
		paths: z.tuple([
			DiagnosticPathSchema,
			DiagnosticPathSchema,
		]),
	})
	.strict()
	.meta({
		id: "DuplicateLineIdDiagnosticSchema",
		description: "Two product lines owned by one item use the same stable line ID.",
	});

export type DuplicateLineIdDiagnosticSchema = typeof DuplicateLineIdDiagnosticSchema;
export namespace DuplicateLineIdDiagnosticSchema {
	export type Type = z.infer<DuplicateLineIdDiagnosticSchema>;
}
