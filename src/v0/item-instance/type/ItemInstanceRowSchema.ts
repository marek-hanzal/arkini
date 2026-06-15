import { z } from "zod";
import { GameItemIdSchema } from "~/v0/manifest/GameItemIdSchema";
import { PositiveIntegerSchema } from "~/v0/manifest/PositiveIntegerSchema";
import { ItemInstanceIdSchema } from "./ItemInstanceIdSchema";
import { ItemLocationKindSchema } from "./ItemLocationKindSchema";

export const ItemInstanceRowSchema = z.object({
	id: ItemInstanceIdSchema,
	saveGameId: z.string().min(1),
	itemDefinitionId: GameItemIdSchema,
	quantity: PositiveIntegerSchema,
	locationKind: ItemLocationKindSchema,
	boardX: z.number().int().nullable(),
	boardY: z.number().int().nullable(),
	inventorySlotIndex: z.number().int().nullable(),
	ownerItemInstanceId: z.string().min(1).nullable(),
	inputItemDefinitionId: GameItemIdSchema.nullable(),
	stateJson: z.string(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
});

type ItemInstanceRowSchema = typeof ItemInstanceRowSchema;
export namespace ItemInstanceRowSchema {
	export type Type = z.infer<ItemInstanceRowSchema>;
}
