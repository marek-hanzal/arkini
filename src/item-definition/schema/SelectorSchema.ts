import { z } from "zod";

import { IdSchema } from "~/game-config/schema/IdSchema";

/**
 * One explicit canonical item selector.
 */
export const SelectorSchema = z
	.object({
		type: z.literal("item"),
		itemId: IdSchema.describe("The stable ID of the selected canonical item."),
	})
	.strict()
	.meta({
		id: "SelectorSchema",
		description: "A selector that resolves one canonical game item by stable ID.",
	});

export type SelectorSchema = typeof SelectorSchema;

export namespace SelectorSchema {
	export type Type = z.infer<SelectorSchema>;
}
