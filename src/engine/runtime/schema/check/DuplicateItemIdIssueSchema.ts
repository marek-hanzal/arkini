import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";

/**
 * Multiple live items share one stable runtime identity.
 */
export const DuplicateItemIdIssueSchema = z
	.object({
		itemId: IdSchema.describe("The duplicated live item identity."),
		type: RuntimeCheckIssueEnumSchema.extract([
			"DuplicateItemId",
		]),
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
