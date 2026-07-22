import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const MissingResourceDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			DiagnosticCodeEnumSchema.enum.ResourceMissing,
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			DiagnosticSeverityEnumSchema.enum.Error,
		]),
		resourceId: IdSchema,
	})
	.strict()
	.meta({
		id: "MissingResourceDiagnosticSchema",
	});

export type MissingResourceDiagnosticSchema = typeof MissingResourceDiagnosticSchema;
export namespace MissingResourceDiagnosticSchema {
	export type Type = z.infer<MissingResourceDiagnosticSchema>;
}
