import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/engine/validation/schema/DiagnosticRecordEntityEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
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
