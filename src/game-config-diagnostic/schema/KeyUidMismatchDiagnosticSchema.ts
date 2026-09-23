import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticRecordEntityEnumSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const KeyUidMismatchDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"ConfigKeyUidMismatch",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
		]),
		entity: DiagnosticRecordEntityEnumSchema,
		key: IdSchema,
		uid: IdSchema,
	})
	.strict()
	.meta({
		id: "KeyUidMismatchDiagnosticSchema",
		description: "A canonical record key differs from its embedded immutable UID.",
	});

export type KeyUidMismatchDiagnosticSchema = typeof KeyUidMismatchDiagnosticSchema;

export namespace KeyUidMismatchDiagnosticSchema {
	export type Type = z.infer<KeyUidMismatchDiagnosticSchema>;
}
