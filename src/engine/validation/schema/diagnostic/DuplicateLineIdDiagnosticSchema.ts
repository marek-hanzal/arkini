import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { DiagnosticPathSchema } from "../DiagnosticPathSchema";
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
