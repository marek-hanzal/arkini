import { z } from "zod";
import { GameItemIdSchema } from "~/config/GameIdSchema";

export const ItemTargetLimitViewSchema = z.object({
	itemId: GameItemIdSchema,
	maxCount: z.number().int().positive(),
	ownedQuantity: z.number().int().nonnegative(),
	remainingQuantity: z.number().int().nonnegative(),
	requiredQuantity: z.number().int().positive(),
	sourceItemId: GameItemIdSchema.optional(),
});

type ItemTargetLimitViewSchema = typeof ItemTargetLimitViewSchema;
export namespace ItemTargetLimitViewSchema {
	export type Type = z.infer<ItemTargetLimitViewSchema>;
}

export type ItemTargetLimitView = ItemTargetLimitViewSchema.Type;
