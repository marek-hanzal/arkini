import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";

/** One live stack exceeds the limit allowed by its current runtime state. */
export const ItemStackSizeIssueSchema = z
	.object({
		itemId: IdSchema.describe("The live item identity with an excessive stack quantity."),
		canonicalItemId: IdSchema.describe("The canonical item represented by the live stack."),
		maxStackSize: PositiveIntegerSchema.describe(
			"The maximum stack quantity allowed by the item's current runtime state.",
		),
		quantity: PositiveIntegerSchema.describe("The current excessive stack quantity."),
		type: z.literal("item:stack-size"),
	})
	.strict()
	.meta({
		id: "ItemStackSizeIssueSchema",
		description: "One live stack exceeds the limit allowed by its current runtime state.",
	});

export type ItemStackSizeIssueSchema = typeof ItemStackSizeIssueSchema;

export namespace ItemStackSizeIssueSchema {
	export type Type = z.infer<ItemStackSizeIssueSchema>;
}
