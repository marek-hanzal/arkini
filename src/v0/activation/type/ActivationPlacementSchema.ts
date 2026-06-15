import { z } from "zod";
import { GameItemIdSchema } from "~/v0/manifest/GameItemIdSchema";

export const ActivationPlacementSchema = z.discriminatedUnion("kind", [
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
		itemInstanceId: z.string().min(1).optional(),
		slotIndex: z.number().int().nonnegative().optional(),
	}),
]);

type ActivationPlacementSchema = typeof ActivationPlacementSchema;
export namespace ActivationPlacementSchema {
	export type Type = z.infer<ActivationPlacementSchema>;
}
