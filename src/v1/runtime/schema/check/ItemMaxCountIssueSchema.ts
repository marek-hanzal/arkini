import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";

/**
 * The total live quantity of one canonical item exceeds its configured maximum.
 */
export const ItemMaxCountIssueSchema = z
	.object({
		itemId: IdSchema.describe("The canonical item whose live quantity exceeds maxCount."),
		itemIds: z
			.array(IdSchema)
			.min(1)
			.describe("The live item identities contributing to the excessive quantity."),
		maxCount: PositiveIntegerSchema.describe("The configured maximum live quantity."),
		quantity: PositiveIntegerSchema.describe("The current excessive live quantity."),
		type: z.literal("item:max-count"),
	})
	.strict()
	.meta({
		id: "ItemMaxCountIssueSchema",
		description: "The total live quantity of one canonical item exceeds maxCount.",
	});

export type ItemMaxCountIssueSchema = typeof ItemMaxCountIssueSchema;

export namespace ItemMaxCountIssueSchema {
	export type Type = z.infer<ItemMaxCountIssueSchema>;
}
