import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const UnusedResourceDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"ResourceUnused",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Warning",
		]),
		resourceId: IdSchema,
	})
	.strict()
	.meta({
		id: "UnusedResourceDiagnosticSchema",
	});

export type UnusedResourceDiagnosticSchema = typeof UnusedResourceDiagnosticSchema;
export namespace UnusedResourceDiagnosticSchema {
	export type Type = z.infer<UnusedResourceDiagnosticSchema>;
}
