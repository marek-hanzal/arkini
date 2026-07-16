import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const DuplicateRecordDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("source:duplicate-record"),
		severity: z.literal("error"),
		entity: z.enum([
			"item",
			"category",
		]),
		key: IdSchema,
		sources: z.tuple([
			z.string().min(1),
			z.string().min(1),
		]),
	})
	.strict()
	.meta({
		id: "DuplicateRecordDiagnosticSchema",
		description: "Two source fragments provide the same canonical record key.",
	});

export type DuplicateRecordDiagnosticSchema = typeof DuplicateRecordDiagnosticSchema;

export namespace DuplicateRecordDiagnosticSchema {
	export type Type = z.infer<DuplicateRecordDiagnosticSchema>;
}
