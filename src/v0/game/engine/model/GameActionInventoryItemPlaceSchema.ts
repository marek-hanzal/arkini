import { z } from "zod";

const NonNegativeIntegerSchema = z.number().int().min(0);

export const GameActionInventoryItemPlaceSchema = z
	.object({
		slotIndex: NonNegativeIntegerSchema,
		type: z.literal("inventory.item.place"),
		x: NonNegativeIntegerSchema,
		y: NonNegativeIntegerSchema,
	})
	.strict();

export type GameActionInventoryItemPlaceSchema = typeof GameActionInventoryItemPlaceSchema;

export namespace GameActionInventoryItemPlaceSchema {
	export type Type = z.infer<typeof GameActionInventoryItemPlaceSchema>;
}
