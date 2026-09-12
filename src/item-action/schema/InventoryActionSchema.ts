import { z } from "zod";
import { BaseSchema } from "~/item-action/schema/BaseSchema";

/** Opens the Inventory screen after the shared immediate requirements settle. */
export const InventoryActionSchema = z
	.object({
		...BaseSchema.shape,
		type: z.literal("inventory"),
	})
	.strict()
	.meta({
		id: "itemAction.InventoryActionSchema",
		description: "An immediate action opening the Inventory screen.",
	});
export type InventoryActionSchema = typeof InventoryActionSchema;
export namespace InventoryActionSchema {
	export type Type = z.infer<InventoryActionSchema>;
}
