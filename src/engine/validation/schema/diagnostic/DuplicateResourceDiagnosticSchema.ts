import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const DuplicateResourceDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract(["ResourceDuplicate"]),
		severity: DiagnosticSeverityEnumSchema.extract(["Error"]),
		resourceId: IdSchema,
		sources: z.tuple([
			z.string().min(1),
			z.string().min(1),
		]),
	})
	.strict()
	.meta({
		id: "DuplicateResourceDiagnosticSchema",
	});

export type DuplicateResourceDiagnosticSchema = typeof DuplicateResourceDiagnosticSchema;
export namespace DuplicateResourceDiagnosticSchema {
	export type Type = z.infer<DuplicateResourceDiagnosticSchema>;
}
