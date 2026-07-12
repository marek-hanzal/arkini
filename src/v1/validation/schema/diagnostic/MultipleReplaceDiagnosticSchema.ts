import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const MultipleReplaceDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("output:multiple-replace"),
		severity: z.literal("error"),
		ownerItemId: IdSchema,
		maximum: PositiveIntegerSchema,
	})
	.strict()
	.meta({
		id: "MultipleReplaceDiagnosticSchema",
		description: "One selected output result may replace its origin more than once.",
	});

export type MultipleReplaceDiagnosticSchema = typeof MultipleReplaceDiagnosticSchema;

export namespace MultipleReplaceDiagnosticSchema {
	export type Type = z.infer<MultipleReplaceDiagnosticSchema>;
}
