import { z } from "zod";
import { GameItemIdSchema } from "~/manifest/GameItemIdSchema";

export const ProducerPlacementSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("board"),
		itemId: GameItemIdSchema,
		boardItemId: z.string().min(1).optional(),
		x: z.number().int().nonnegative().optional(),
		y: z.number().int().nonnegative().optional(),
	}),
	z.object({
		kind: z.literal("inventory"),
		itemId: GameItemIdSchema,
		slotIndex: z.number().int().nonnegative().optional(),
	}),
]);

type ProducerPlacementSchema = typeof ProducerPlacementSchema;
export namespace ProducerPlacementSchema {
	export type Type = z.infer<ProducerPlacementSchema>;
}

export type ProducerPlacement = ProducerPlacementSchema.Type;
