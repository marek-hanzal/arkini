import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PlacementSpawnPlanSchema } from "./PlacementSpawnPlanSchema";
import { PlacementStackPlanSchema } from "./PlacementStackPlanSchema";

/**
 * Every runtime mutation required to place one resolved drop atomically.
 */
export const PlacementPlanSchema = z
	.object({
		/**
		 * Existing runtime item IDs removed before additions and spawns are applied.
		 */
		remove: z
			.array(IdSchema)
			.describe("Existing runtime item IDs removed before placement is applied."),
		/**
		 * Quantity additions applied to existing runtime stacks.
		 */
		stack: z
			.array(PlacementStackPlanSchema)
			.describe("Quantity additions applied to existing runtime stacks."),
		/**
		 * Fully hydrated runtime items created at concrete locations.
		 */
		spawn: z
			.array(PlacementSpawnPlanSchema)
			.describe("Fully hydrated runtime items created at concrete locations."),
	})
	.strict()
	.meta({
		id: "PlacementPlanSchema",
		description: "Every runtime mutation required to place one resolved drop atomically.",
	});

export type PlacementPlanSchema = typeof PlacementPlanSchema;

export namespace PlacementPlanSchema {
	export type Type = z.infer<PlacementPlanSchema>;
}
