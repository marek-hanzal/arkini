import { z } from "zod";
import { gameConfig } from "./gameConfig";

export const SaveRowSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	boardWidth: z.literal(gameConfig.game.board.width),
	boardHeight: z.literal(gameConfig.game.board.height),
	inventorySlots: z.literal(gameConfig.game.inventory.slots),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
});

type SaveRowSchema = typeof SaveRowSchema;
export namespace SaveRowSchema {
	export type Type = z.infer<SaveRowSchema>;
}
