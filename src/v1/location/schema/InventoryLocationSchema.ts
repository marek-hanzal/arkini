import { z } from "zod";

import { PositionSchema } from "~/v1/grid/schema/PositionSchema";

/** One concrete location in the universe-wide passive inventory. */
export const InventoryLocationSchema = z
	.object({
		scope: z.literal("inventory"),
		position: PositionSchema.describe("The coordinates inside the inventory."),
	})
	.strict()
	.meta({
		id: "InventoryLocationSchema",
		description: "One concrete location in the universe-wide passive inventory.",
	});

export type InventoryLocationSchema = typeof InventoryLocationSchema;

export namespace InventoryLocationSchema {
	export type Type = z.infer<InventoryLocationSchema>;
}
