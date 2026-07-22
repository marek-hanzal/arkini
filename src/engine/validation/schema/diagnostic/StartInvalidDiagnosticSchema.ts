import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const StartInvalidDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			DiagnosticCodeEnumSchema.enum.StartInvalid,
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			DiagnosticSeverityEnumSchema.enum.Error,
		]),
		failureTag: IdSchema,
	})
	.strict()
	.meta({
		id: "StartInvalidDiagnosticSchema",
		description: "The configured start state cannot be materialized as a valid runtime.",
	});

export type StartInvalidDiagnosticSchema = typeof StartInvalidDiagnosticSchema;

export namespace StartInvalidDiagnosticSchema {
	export type Type = z.infer<StartInvalidDiagnosticSchema>;
}
