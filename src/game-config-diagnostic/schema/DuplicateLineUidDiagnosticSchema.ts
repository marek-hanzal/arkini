import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { DiagnosticPathSchema } from "./DiagnosticPathSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const DuplicateLineUidDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"LineDuplicateUid",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
		]),
		ownerItemUid: IdSchema,
		lineUid: IdSchema,
		paths: z.tuple([
			DiagnosticPathSchema,
			DiagnosticPathSchema,
		]),
	})
	.strict()
	.meta({
		id: "DuplicateLineUidDiagnosticSchema",
		description:
			"Two product lines use the same project-wide UID; paths identify both owners and occurrences.",
	});

export type DuplicateLineUidDiagnosticSchema = typeof DuplicateLineUidDiagnosticSchema;
export namespace DuplicateLineUidDiagnosticSchema {
	export type Type = z.infer<DuplicateLineUidDiagnosticSchema>;
}
