import { z } from "zod";
import { SwapInventorySlotsInputSchema } from "~/play/schema/SwapInventorySlotsInputSchema";

export const InventorySwapCommandSchema = SwapInventorySlotsInputSchema.extend({
	type: z.literal("inventory.swap"),
});

type InventorySwapCommandSchema = typeof InventorySwapCommandSchema;
export namespace InventorySwapCommandSchema {
	export type Type = z.infer<InventorySwapCommandSchema>;
}
