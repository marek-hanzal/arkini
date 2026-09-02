import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticRecordEntityEnumSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const KeyIdMismatchDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"ConfigKeyIdMismatch",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
		]),
		entity: DiagnosticRecordEntityEnumSchema,
		key: IdSchema,
		id: IdSchema,
	})
	.strict()
	.meta({
		id: "KeyIdMismatchDiagnosticSchema",
		description: "A canonical record key differs from its embedded immutable ID.",
	});

export type KeyIdMismatchDiagnosticSchema = typeof KeyIdMismatchDiagnosticSchema;

export namespace KeyIdMismatchDiagnosticSchema {
	export type Type = z.infer<KeyIdMismatchDiagnosticSchema>;
}
