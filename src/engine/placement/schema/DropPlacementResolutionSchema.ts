import { z } from "zod";

import { DropPlacementResultSchema } from "./DropPlacementResultSchema";

/**
 * Concrete placement of one configured drop, or no placement when its rules reject it.
 */
export const DropPlacementResolutionSchema = DropPlacementResultSchema.optional().meta({
	id: "DropPlacementResolutionSchema",
	description:
		"The optional concrete runtime placement produced by one configured drop evaluation.",
});

export type DropPlacementResolutionSchema = typeof DropPlacementResolutionSchema;

export namespace DropPlacementResolutionSchema {
	export type Type = z.infer<DropPlacementResolutionSchema>;
}
