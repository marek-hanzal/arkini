import { z } from "zod";
import { GameItemIdSchema } from "~/v0/manifest/GameItemIdSchema";
import { PositiveIntegerSchema } from "~/v0/manifest/PositiveIntegerSchema";
import { InventorySlotIndexSchema } from "./InventorySlotIndexSchema";

export const InventoryStackRowSchema = z.object({
	id: z.string().min(1),
	saveGameId: z.string().min(1),
	slotIndex: InventorySlotIndexSchema,
	itemDefinitionId: GameItemIdSchema,
	quantity: PositiveIntegerSchema,
	stateJson: z.string(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
});

type InventoryStackRowSchema = typeof InventoryStackRowSchema;
export namespace InventoryStackRowSchema {
	export type Type = z.infer<InventoryStackRowSchema>;
}
