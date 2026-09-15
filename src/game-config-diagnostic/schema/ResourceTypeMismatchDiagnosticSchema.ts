import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const ResourceTypeMismatchDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"ResourceTypeMismatch",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
		]),
		resourceId: IdSchema,
		expectedType: ResourceTypeSchema,
		actualType: ResourceTypeSchema,
	})
	.strict()
	.meta({
		id: "ResourceTypeMismatchDiagnosticSchema",
	});

export type ResourceTypeMismatchDiagnosticSchema = typeof ResourceTypeMismatchDiagnosticSchema;
export namespace ResourceTypeMismatchDiagnosticSchema {
	export type Type = z.infer<ResourceTypeMismatchDiagnosticSchema>;
}
