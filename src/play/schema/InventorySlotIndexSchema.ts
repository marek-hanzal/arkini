import { z } from "zod";
import { gameConfig } from "./gameConfig";

export const InventorySlotIndexSchema = z
	.number()
	.int()
	.min(0)
	.max(gameConfig.game.inventory.slots - 1);
