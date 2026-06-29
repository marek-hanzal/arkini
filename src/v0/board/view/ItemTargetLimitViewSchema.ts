import { z } from "zod";
import { GameItemIdSchema } from "~/v0/game/config/GameIdSchema";

export const ItemTargetLimitViewSchema = z.object({
	itemId: GameItemIdSchema,
	maxCount: z.number().int().positive(),
	ownedQuantity: z.number().int().nonnegative(),
	remainingQuantity: z.number().int().nonnegative(),
	requiredQuantity: z.number().int().positive(),
	sourceItemId: GameItemIdSchema.optional(),
});
