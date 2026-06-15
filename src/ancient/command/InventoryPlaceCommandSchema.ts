import { z } from "zod";
import { PlaceInventoryItemInputSchema } from "~/play/schema/PlaceInventoryItemInputSchema";

export const InventoryPlaceCommandSchema = PlaceInventoryItemInputSchema.extend({
	type: z.literal("inventory.place"),
});

type InventoryPlaceCommandSchema = typeof InventoryPlaceCommandSchema;
export namespace InventoryPlaceCommandSchema {
	export type Type = z.infer<InventoryPlaceCommandSchema>;
}
