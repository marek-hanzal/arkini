import { z } from "zod";
import { IdSchema } from "~/config/IdSchema";

export const ItemTargetLimitViewSchema = z.object({
	itemId: IdSchema,
	maxCount: z.number().int().positive(),
	ownedQuantity: z.number().int().nonnegative(),
	remainingQuantity: z.number().int().nonnegative(),
	requiredQuantity: z.number().int().positive(),
	sourceItemId: IdSchema.optional(),
});

type ItemTargetLimitViewSchema = typeof ItemTargetLimitViewSchema;
export namespace ItemTargetLimitViewSchema {
	export type Type = z.infer<ItemTargetLimitViewSchema>;
}

export type ItemTargetLimitView = ItemTargetLimitViewSchema.Type;
