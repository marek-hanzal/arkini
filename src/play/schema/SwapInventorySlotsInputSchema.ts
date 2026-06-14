import { z } from "zod";
import { InventorySlotIndexSchema } from "./InventorySlotIndexSchema";

export const SwapInventorySlotsInputSchema = z.object({
	sourceSlotIndex: InventorySlotIndexSchema,
	targetSlotIndex: InventorySlotIndexSchema,
});
