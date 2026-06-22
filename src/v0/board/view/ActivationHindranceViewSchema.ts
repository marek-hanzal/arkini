import { z } from "zod";
import { GameItemIdSchema } from "~/v0/game/config/GameIdSchema";

const HindranceMatchViewSchema = z.object({
	itemId: GameItemIdSchema,
	distance: z.number().int().nonnegative().optional(),
});

export const ActivationHindranceViewSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("passive"),
		itemId: GameItemIdSchema,
		quantity: z.number().int().positive(),
		activeQuantity: z.number().int().nonnegative(),
		activeStacks: z.number().int().nonnegative(),
		durationMultiplier: z.number().min(1),
	}),
	z.object({
		type: z.literal("proximity"),
		itemIds: z.array(GameItemIdSchema),
		distance: z.number().int().positive(),
		matches: z.array(HindranceMatchViewSchema),
		durationMultiplier: z.number().min(1),
	}),
]);

type ActivationHindranceViewSchema = typeof ActivationHindranceViewSchema;
export namespace ActivationHindranceViewSchema {
	export type Type = z.infer<ActivationHindranceViewSchema>;
}

export type ActivationHindranceView = ActivationHindranceViewSchema.Type;
