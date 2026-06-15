import { z } from "zod";
import { GameItemIdSchema } from "~/v0/manifest/GameItemIdSchema";

export const ActivationRequirementViewSchema = z.object({
	itemId: GameItemIdSchema,
	quantity: z.number().int().nonnegative(),
	capacity: z.number().int().nonnegative(),
	stored: z.number().int().nonnegative(),
});

type ActivationRequirementViewSchema = typeof ActivationRequirementViewSchema;
export namespace ActivationRequirementViewSchema {
	export type Type = z.infer<ActivationRequirementViewSchema>;
}

export type ActivationRequirementView = ActivationRequirementViewSchema.Type;
