import { z } from "zod";
import { BoardViewItemSchema } from "~/board/view/BoardViewItemSchema";
import { InventorySlotSchema } from "~/inventory/view/InventorySlotSchema";

export const GameDragViewSchema = z.object({
	boardItemsById: z.record(z.string(), BoardViewItemSchema),
	inventoryBySlotIndex: z.record(z.string(), InventorySlotSchema),
});

type GameDragViewSchema = typeof GameDragViewSchema;
export namespace GameDragViewSchema {
	export type Type = z.infer<GameDragViewSchema>;
}

export type GameDragView = GameDragViewSchema.Type;
