import { z } from "zod";
import { GameItemIdSchema } from "~/v0/game/config/GameIdSchema";

export const InventoryPlaceResultSchema = z.object({
	boardItemId: z.string().min(1),
	itemId: GameItemIdSchema,
	x: z.number().int().nonnegative(),
	y: z.number().int().nonnegative(),
});

type InventoryPlaceResultSchema = typeof InventoryPlaceResultSchema;
export namespace InventoryPlaceResultSchema {
	export type Type = z.infer<InventoryPlaceResultSchema>;
}

export type InventoryPlaceResult = InventoryPlaceResultSchema.Type;
