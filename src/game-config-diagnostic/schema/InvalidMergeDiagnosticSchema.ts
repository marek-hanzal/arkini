import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { InvalidMergeReasonEnumSchema } from "~/game-config-diagnostic/schema/InvalidMergeReasonEnumSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

/** One authored merge rule cannot execute with its configured source and board topology. */
export const InvalidMergeDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"MergeInvalid",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
		]),
		ownerItemId: IdSchema,
		mergeIndex: z.number().int().nonnegative(),
		reason: InvalidMergeReasonEnumSchema,
	})
	.strict()
	.meta({
		id: "InvalidMergeDiagnosticSchema",
		description: "An authored merge rule cannot execute with its configured source and target.",
	});

export type InvalidMergeDiagnosticSchema = typeof InvalidMergeDiagnosticSchema;

export namespace InvalidMergeDiagnosticSchema {
	export type Type = z.infer<InvalidMergeDiagnosticSchema>;
}
