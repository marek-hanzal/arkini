import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const MissingReferenceDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("config:missing-reference"),
		severity: z.literal("error"),
		reference: z.enum([
			"item",
			"category",
		]),
		referenceId: IdSchema,
	})
	.strict()
	.meta({
		id: "MissingReferenceDiagnosticSchema",
		description: "A completed config references a canonical record that does not exist.",
	});

export type MissingReferenceDiagnosticSchema = typeof MissingReferenceDiagnosticSchema;

export namespace MissingReferenceDiagnosticSchema {
	export type Type = z.infer<MissingReferenceDiagnosticSchema>;
}
