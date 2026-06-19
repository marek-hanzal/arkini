import { z } from "zod";

const NonNegativeIntegerSchema = z.number().int().min(0);
const PositiveIntegerSchema = z.number().int().positive();

export const GameActionInventoryItemPlacePlacementModeSchema = z.enum([
	"exact",
	"nearest_by_manhattan",
]);

export const GameActionInventoryItemPlaceSchema = z
	.object({
		placementMode: GameActionInventoryItemPlacePlacementModeSchema.optional(),
		quantity: PositiveIntegerSchema.optional(),
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
