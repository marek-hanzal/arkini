import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticSeverityEnumSchema";
import { InvalidMergeReasonEnumSchema } from "~/game-config/diagnostic/schema/InvalidMergeReasonEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

/** One authored merge rule cannot participate in the board-only runtime topology. */
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
		description: "An authored merge rule cannot execute through the board-only merge topology.",
	});

export type InvalidMergeDiagnosticSchema = typeof InvalidMergeDiagnosticSchema;

export namespace InvalidMergeDiagnosticSchema {
	export type Type = z.infer<InvalidMergeDiagnosticSchema>;
}
