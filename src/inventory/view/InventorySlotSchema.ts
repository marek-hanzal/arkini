import { z } from "zod";
import { IdSchema } from "~/config/IdSchema";

export const InventorySlotSchema = z.object({
	slotIndex: z.number().int().nonnegative(),
	stack: z
		.object({
			id: z.string().min(1),
			itemId: IdSchema,
			quantity: z.number().int().positive(),
		})
		.optional(),
});

type InventorySlotSchema = typeof InventorySlotSchema;
export namespace InventorySlotSchema {
	export type Type = z.infer<InventorySlotSchema>;
}

export type InventorySlot = InventorySlotSchema.Type;
