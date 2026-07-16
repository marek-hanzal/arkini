import { z } from "zod";

import { DropPlacementResultSchema } from "./DropPlacementResultSchema";

/**
 * Concrete runtime placements produced by one resolved output.
 */
export const OutputPlacementResultSchema = z
	.object({
		/**
		 * Placement result for every resolved drop in authored order.
		 */
		drop: z
			.array(DropPlacementResultSchema)
			.describe("Placement result for every resolved drop in authored order."),
	})
	.strict()
	.meta({
		id: "OutputPlacementResultSchema",
		description: "The concrete runtime placements produced by one resolved output.",
	});

export type OutputPlacementResultSchema = typeof OutputPlacementResultSchema;

export namespace OutputPlacementResultSchema {
	export type Type = z.infer<OutputPlacementResultSchema>;
}
