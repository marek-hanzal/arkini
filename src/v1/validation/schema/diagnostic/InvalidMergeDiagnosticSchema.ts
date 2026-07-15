import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

/** One authored merge rule cannot participate in the board-only runtime topology. */
export const InvalidMergeDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("merge:invalid"),
		severity: z.literal("error"),
		ownerItemId: IdSchema,
		mergeIndex: z.number().int().nonnegative(),
		reason: z.enum([
			"target-unavailable",
			"result-unavailable",
			"self-target-unavailable",
		]),
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
