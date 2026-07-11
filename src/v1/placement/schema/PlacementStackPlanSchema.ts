import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";

/**
 * Adds one positive quantity to an existing runtime item stack.
 */
export const PlacementStackPlanSchema = z
	.object({
		/**
		 * Stable ID of the existing runtime stack receiving the quantity.
		 */
		itemId: IdSchema.describe("The existing runtime stack receiving the quantity."),
		/**
		 * Positive quantity added to the existing stack.
		 */
		quantity: PositiveIntegerSchema.describe(
			"The positive quantity added to the existing stack.",
		),
	})
	.strict()
	.meta({
		id: "PlacementStackPlanSchema",
		description: "One planned positive quantity addition to an existing runtime stack.",
	});

export type PlacementStackPlanSchema = typeof PlacementStackPlanSchema;

export namespace PlacementStackPlanSchema {
	export type Type = z.infer<PlacementStackPlanSchema>;
}
