import { z } from "zod";
import { BoardCellSchema } from "./BoardCellSchema";
import { InventorySlotIndexSchema } from "./InventorySlotIndexSchema";

export const PlaceInventoryItemInputSchema = z.object({
	slotIndex: InventorySlotIndexSchema,
	...BoardCellSchema.shape,
});
