import { z } from "zod";
import { ItemIdSchema } from "~/manifest/ItemIdSchema";
import { PositiveIntegerSchema } from "~/manifest/PositiveIntegerSchema";
import { InventorySlotIndexSchema } from "./InventorySlotIndexSchema";

export const InventoryStackRowSchema = z.object({
	id: z.string().min(1),
	saveGameId: z.string().min(1),
	slotIndex: InventorySlotIndexSchema,
	itemDefinitionId: ItemIdSchema,
	quantity: PositiveIntegerSchema,
	stateJson: z.string(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
});
