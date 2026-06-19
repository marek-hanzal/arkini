import { z } from "zod";
import { BoardItemStateSchema } from "~/v0/board/view/BoardItemStateSchema";
import { GameItemIdSchema } from "~/v0/game/config/GameIdSchema";

export const InventorySlotSchema = z.object({
	slotIndex: z.number().int().nonnegative(),
	stack: z
		.object({
			id: z.string().min(1),
			itemId: GameItemIdSchema,
			quantity: z.number().int().positive(),
			state: BoardItemStateSchema,
			stateJson: z.string(),
			stateful: z.boolean(),
		})
		.optional(),
});

type InventorySlotSchema = typeof InventorySlotSchema;
export namespace InventorySlotSchema {
	export type Type = z.infer<InventorySlotSchema>;
}

export type InventorySlot = InventorySlotSchema.Type;
