import { z } from "zod";
import { InventorySlotSchema } from "./InventorySlotSchema";

export const InventoryViewSchema = z.object({
	slots: z.array(InventorySlotSchema),
	bySlotIndex: z.record(z.string(), InventorySlotSchema),
	stacksByItemId: z.record(z.string(), z.array(InventorySlotSchema)),
	firstEmptySlotIndex: z.number().int().nonnegative().optional(),
});

type InventoryViewSchema = typeof InventoryViewSchema;
export namespace InventoryViewSchema {
	export type Type = z.infer<InventoryViewSchema>;
}

export type InventoryView = InventoryViewSchema.Type;
