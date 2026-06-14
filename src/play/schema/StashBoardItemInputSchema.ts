import { z } from "zod";
import { BoardItemIdSchema } from "./BoardItemIdSchema";
import { InventorySlotIndexSchema } from "./InventorySlotIndexSchema";

export const StashBoardItemInputSchema = z.object({
	boardItemId: BoardItemIdSchema,
	slotIndex: InventorySlotIndexSchema.optional(),
});
