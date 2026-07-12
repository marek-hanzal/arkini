import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const MissingResourceDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("resource:missing"),
		severity: z.literal("error"),
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
