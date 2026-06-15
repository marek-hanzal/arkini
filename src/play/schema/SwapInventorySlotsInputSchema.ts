import { z } from "zod";
import { InventorySlotIndexSchema } from "./InventorySlotIndexSchema";

export const SwapInventorySlotsInputSchema = z.object({
	sourceSlotIndex: InventorySlotIndexSchema,
	targetSlotIndex: InventorySlotIndexSchema,
});

type SwapInventorySlotsInputSchema = typeof SwapInventorySlotsInputSchema;
export namespace SwapInventorySlotsInputSchema {
	export type Type = z.infer<SwapInventorySlotsInputSchema>;
}
