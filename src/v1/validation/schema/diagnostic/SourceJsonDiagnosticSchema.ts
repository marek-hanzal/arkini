import { z } from "zod";

import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const SourceJsonDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("source:json-invalid"),
		severity: z.literal("error"),
	})
	.strict()
	.meta({
		id: "SourceJsonDiagnosticSchema",
		description: "One game source file contains invalid JSON syntax.",
	});

export type SourceJsonDiagnosticSchema = typeof SourceJsonDiagnosticSchema;

export namespace SourceJsonDiagnosticSchema {
	export type Type = z.infer<SourceJsonDiagnosticSchema>;
}
