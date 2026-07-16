import { z } from "zod";

import { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

/**
 * Creates one fully hydrated runtime item at its owned location.
 */
export const PlacementSpawnPlanSchema = z
	.object({
		/**
		 * Fully hydrated runtime item created by this placement step.
		 */
		item: RuntimeItemSchema.describe(
			"The fully hydrated runtime item created by this placement step.",
		),
	})
	.strict()
	.meta({
		id: "PlacementSpawnPlanSchema",
		description: "One fully hydrated runtime item planned for creation.",
	});

export type PlacementSpawnPlanSchema = typeof PlacementSpawnPlanSchema;

export namespace PlacementSpawnPlanSchema {
	export type Type = z.infer<PlacementSpawnPlanSchema>;
}
