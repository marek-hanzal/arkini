import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

import { DiagnosticPathSchema } from "./DiagnosticPathSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const MultipleLineSelectionsDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"LineMultipleSelections",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
		]),
		ownerItemId: IdSchema,
		selection: z.enum([
			"default",
			"clock",
		]),
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
		id: "MultipleLineSelectionsDiagnosticSchema",
		description:
			"Two product lines owned by one item are both marked for the same authored selection.",
	});

export type MultipleLineSelectionsDiagnosticSchema = typeof MultipleLineSelectionsDiagnosticSchema;
export namespace MultipleLineSelectionsDiagnosticSchema {
	export type Type = z.infer<MultipleLineSelectionsDiagnosticSchema>;
}
