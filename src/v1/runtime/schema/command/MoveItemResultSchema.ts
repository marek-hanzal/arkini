import { z } from "zod";

import { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

/**
 * One successfully moved item and the location it previously owned.
 */
export const MoveItemResultSchema = z
	.object({
		item: RuntimeItemSchema.describe("The moved runtime item at its new location."),
		previousLocation: GridLocationSchema.describe("The location owned before the move."),
	})
	.strict()
	.meta({
		id: "MoveItemResultSchema",
		description: "One moved item and its previous location.",
	});

export type MoveItemResultSchema = typeof MoveItemResultSchema;

export namespace MoveItemResultSchema {
	export type Type = z.infer<MoveItemResultSchema>;
}
