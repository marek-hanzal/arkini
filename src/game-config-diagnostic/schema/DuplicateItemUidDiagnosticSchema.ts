import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticPathSchema } from "./DiagnosticPathSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const DuplicateItemUidDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"ItemDuplicateUid",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
		]),
		uid: IdSchema,
		itemIds: z.tuple([
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
		id: "DuplicateItemUidDiagnosticSchema",
		description: "Two canonical items use the same immutable low-level identity.",
	});

export type DuplicateItemUidDiagnosticSchema = typeof DuplicateItemUidDiagnosticSchema;

export namespace DuplicateItemUidDiagnosticSchema {
	export type Type = z.infer<DuplicateItemUidDiagnosticSchema>;
}
