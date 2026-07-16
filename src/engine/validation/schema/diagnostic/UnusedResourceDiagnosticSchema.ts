import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const UnusedResourceDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("resource:unused"),
		severity: z.literal("warning"),
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
