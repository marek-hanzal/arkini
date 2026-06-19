import { z } from "zod";
import { GameItemIdSchema } from "~/v0/game/config/GameIdSchema";

export const ActivationRequirementViewSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("stored"),
		itemId: GameItemIdSchema,
		quantity: z.number().int().nonnegative(),
		capacity: z.number().int().nonnegative(),
		stored: z.number().int().nonnegative(),
	}),
	z.object({
		type: z.literal("passive"),
		itemId: GameItemIdSchema,
		quantity: z.number().int().nonnegative(),
		capacity: z.number().int().nonnegative(),
		stored: z.number().int().nonnegative(),
	}),
	z.object({
		type: z.literal("proximity"),
		itemIds: z.array(GameItemIdSchema),
		distance: z.number().int().positive(),
		durationFactor: z.number().nonnegative().optional(),
		durationMultiplier: z.number().min(1).optional(),
		satisfied: z.boolean(),
		matchedItemId: GameItemIdSchema.optional(),
		matchedDistance: z.number().int().nonnegative().optional(),
	}),
]);

type ActivationRequirementViewSchema = typeof ActivationRequirementViewSchema;
export namespace ActivationRequirementViewSchema {
	export type Type = z.infer<ActivationRequirementViewSchema>;
}

export type ActivationRequirementView = ActivationRequirementViewSchema.Type;
