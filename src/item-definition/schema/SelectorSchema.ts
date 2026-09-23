import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";

/**
 * One explicit canonical item selector.
 */
export const SelectorSchema = z
	.object({
		type: z.literal("item"),
		itemUid: IdSchema.describe("The immutable UID of the selected canonical item."),
	})
	.strict()
	.meta({
		id: "SelectorSchema",
		description: "A selector that resolves one canonical game item by immutable UID.",
	});

export type SelectorSchema = typeof SelectorSchema;

export namespace SelectorSchema {
	export type Type = z.infer<SelectorSchema>;
}
