import { z } from "zod";

import { DropResultSchema } from "~/engine/output/schema/DropResultSchema";
import { PlacementResultSchema } from "./PlacementResultSchema";

/**
 * Concrete runtime placement of one resolved drop.
 */
export const DropPlacementResultSchema = z
	.object({
		/**
		 * Resolved drop that requested this placement.
		 */
		drop: DropResultSchema.describe("The resolved drop that requested this placement."),
		/**
		 * Concrete runtime changes used to place the drop.
		 */
		placement: PlacementResultSchema.describe(
			"The concrete runtime changes used to place the drop.",
		),
	})
	.strict()
	.meta({
		id: "DropPlacementResultSchema",
		description: "The concrete runtime placement of one resolved drop.",
	});

export type DropPlacementResultSchema = typeof DropPlacementResultSchema;

export namespace DropPlacementResultSchema {
	export type Type = z.infer<DropPlacementResultSchema>;
}
