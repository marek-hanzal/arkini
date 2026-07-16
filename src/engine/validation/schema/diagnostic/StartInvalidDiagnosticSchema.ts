import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const StartInvalidDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("start:invalid"),
		severity: z.literal("error"),
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
