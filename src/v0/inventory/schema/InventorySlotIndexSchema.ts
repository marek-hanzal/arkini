import { z } from "zod";
import { gameConfig } from "~/v0/game/gameConfig";

export const InventorySlotIndexSchema = z
	.number()
	.int()
	.min(0)
	.max(gameConfig.game.inventory.slots - 1);

type InventorySlotIndexSchema = typeof InventorySlotIndexSchema;
export namespace InventorySlotIndexSchema {
	export type Type = z.infer<InventorySlotIndexSchema>;
}
