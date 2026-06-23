import { z } from "zod";
import { InventorySlotSchema } from "./InventorySlotSchema";

const InventoryViewSchema = z.object({
	slots: z.array(InventorySlotSchema),
	bySlotIndex: z.record(z.string(), InventorySlotSchema),
	stacksByItemId: z.record(z.string(), z.array(InventorySlotSchema)),
	firstEmptySlotIndex: z.number().int().nonnegative().optional(),
});


export type InventoryView = z.infer<typeof InventoryViewSchema>;
