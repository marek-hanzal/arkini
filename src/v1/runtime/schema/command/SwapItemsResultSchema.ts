import { z } from "zod";

import { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

/**
 * Two runtime items after their locations were atomically exchanged.
 */
export const SwapItemsResultSchema = z
	.object({
		first: RuntimeItemSchema.describe("The first item after the swap."),
		second: RuntimeItemSchema.describe("The second item after the swap."),
	})
	.strict()
	.meta({
		id: "SwapItemsResultSchema",
		description: "Two runtime items after an atomic location swap.",
	});

export type SwapItemsResultSchema = typeof SwapItemsResultSchema;

export namespace SwapItemsResultSchema {
	export type Type = z.infer<SwapItemsResultSchema>;
}
