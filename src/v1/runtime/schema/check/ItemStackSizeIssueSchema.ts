import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";

/**
 * One live stack exceeds the canonical item's configured stack size.
 */
export const ItemStackSizeIssueSchema = z
	.object({
		itemId: IdSchema.describe("The live item identity with an excessive stack quantity."),
		canonicalItemId: IdSchema.describe("The canonical item represented by the live stack."),
		maxStackSize: PositiveIntegerSchema.describe("The configured maximum stack quantity."),
		quantity: PositiveIntegerSchema.describe("The current excessive stack quantity."),
		type: z.literal("item:stack-size"),
	})
	.strict()
	.meta({
		id: "ItemStackSizeIssueSchema",
		description: "One live stack exceeds the canonical item's configured stack size.",
	});

export type ItemStackSizeIssueSchema = typeof ItemStackSizeIssueSchema;

export namespace ItemStackSizeIssueSchema {
	export type Type = z.infer<ItemStackSizeIssueSchema>;
}
