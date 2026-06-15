import { z } from "zod";
import { GameItemIdSchema } from "~/manifest/GameItemIdSchema";

export const ActivationInputViewSchema = z.object({
	itemId: GameItemIdSchema,
	quantity: z.number().int().nonnegative(),
	capacity: z.number().int().nonnegative(),
	stored: z.number().int().nonnegative(),
});

type ActivationInputViewSchema = typeof ActivationInputViewSchema;
export namespace ActivationInputViewSchema {
	export type Type = z.infer<ActivationInputViewSchema>;
}

export type ActivationInputView = ActivationInputViewSchema.Type;
