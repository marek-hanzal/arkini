import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const DuplicateResourceDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("resource:duplicate"),
		severity: z.literal("error"),
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
