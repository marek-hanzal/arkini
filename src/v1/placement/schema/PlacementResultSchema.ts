import { z } from "zod";

import { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { PlacementStackResultSchema } from "./PlacementStackResultSchema";

/**
 * Concrete runtime changes produced by applying one placement plan.
 */
export const PlacementResultSchema = z
	.object({
		/**
		 * Existing runtime items removed by this placement.
		 */
		remove: z
			.array(RuntimeItemSchema)
			.describe("Existing runtime items removed by this placement."),
		/**
		 * Existing runtime stacks changed by this placement.
		 */
		stack: z
			.array(PlacementStackResultSchema)
			.describe("Existing runtime stacks changed by this placement."),
		/**
		 * New runtime items created by this placement.
		 */
		spawn: z.array(RuntimeItemSchema).describe("New runtime items created by this placement."),
	})
	.strict()
	.meta({
		id: "PlacementResultSchema",
		description: "The concrete runtime changes produced by one applied placement plan.",
	});

export type PlacementResultSchema = typeof PlacementResultSchema;

export namespace PlacementResultSchema {
	export type Type = z.infer<PlacementResultSchema>;
}
