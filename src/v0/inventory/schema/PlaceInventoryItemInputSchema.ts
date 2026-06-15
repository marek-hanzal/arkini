import { z } from "zod";
import { BoardCellSchema } from "~/v0/board/schema/BoardCellSchema";
import { InventorySlotIndexSchema } from "./InventorySlotIndexSchema";

export const PlaceInventoryItemInputSchema = z.object({
	slotIndex: InventorySlotIndexSchema,
	...BoardCellSchema.shape,
});

type PlaceInventoryItemInputSchema = typeof PlaceInventoryItemInputSchema;
export namespace PlaceInventoryItemInputSchema {
	export type Type = z.infer<PlaceInventoryItemInputSchema>;
}
