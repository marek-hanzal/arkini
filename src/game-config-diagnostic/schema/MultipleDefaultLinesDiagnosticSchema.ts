import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

import { DiagnosticPathSchema } from "./DiagnosticPathSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const MultipleDefaultLinesDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"LineMultipleDefaults",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
		]),
		ownerItemId: IdSchema,
		lineIds: z.tuple([
			IdSchema,
			IdSchema,
		]),
		paths: z.tuple([
			DiagnosticPathSchema,
			DiagnosticPathSchema,
		]),
	})
	.strict()
	.meta({
		id: "MultipleDefaultLinesDiagnosticSchema",
		description: "Two product lines owned by one item are both marked as authored defaults.",
	});

export type MultipleDefaultLinesDiagnosticSchema = typeof MultipleDefaultLinesDiagnosticSchema;
export namespace MultipleDefaultLinesDiagnosticSchema {
	export type Type = z.infer<MultipleDefaultLinesDiagnosticSchema>;
}
