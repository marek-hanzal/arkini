import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

/** One persisted default-line selection no longer belongs to its exact live owner. */
export const DefaultLineIssueSchema = z
	.object({
		type: z.literal("line:default"),
		ownerItemId: IdSchema,
		lineId: IdSchema,
		reason: z.enum([
			"owner-missing",
			"owner-unsupported",
			"line-missing",
		]),
	})
	.strict()
	.meta({
		id: "DefaultLineIssueSchema",
		description: "One invalid save-backed default product-line selection.",
	});

export type DefaultLineIssueSchema = typeof DefaultLineIssueSchema;

export namespace DefaultLineIssueSchema {
	export type Type = z.infer<DefaultLineIssueSchema>;
}
