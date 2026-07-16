import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

/**
 * Final state of one existing stack changed by placement.
 */
export const PlacementStackResultSchema = z
	.object({
		/**
		 * Final hydrated runtime stack after placement.
		 */
		item: RuntimeItemSchema.describe("The final runtime stack after placement."),
		/**
		 * Positive quantity added to this stack.
		 */
		quantity: PositiveIntegerSchema.describe(
			"The positive quantity added to this existing stack.",
		),
	})
	.strict()
	.meta({
		id: "PlacementStackResultSchema",
		description: "The final state and added quantity of one existing stack.",
	});

export type PlacementStackResultSchema = typeof PlacementStackResultSchema;

export namespace PlacementStackResultSchema {
	export type Type = z.infer<PlacementStackResultSchema>;
}
