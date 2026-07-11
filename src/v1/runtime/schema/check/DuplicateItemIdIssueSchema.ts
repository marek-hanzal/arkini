import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";

/**
 * Multiple live items share one stable runtime identity.
 */
export const DuplicateItemIdIssueSchema = z
	.object({
		itemId: IdSchema.describe("The duplicated live item identity."),
		type: z.literal("item:id:duplicate"),
	})
	.strict()
	.meta({
		id: "DuplicateItemIdIssueSchema",
		description: "Multiple live items share one stable runtime identity.",
	});

export type DuplicateItemIdIssueSchema = typeof DuplicateItemIdIssueSchema;

export namespace DuplicateItemIdIssueSchema {
	export type Type = z.infer<DuplicateItemIdIssueSchema>;
}
