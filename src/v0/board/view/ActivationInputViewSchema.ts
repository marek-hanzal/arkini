import { z } from "zod";
import { IdSchema } from "~/config/IdSchema";

export const ActivationInputViewSchema = z.object({
	itemId: IdSchema,
	quantity: z.number().int().nonnegative(),
	capacity: z.number().int().nonnegative(),
	consume: z.boolean(),
	mode: z
		.enum([
			"exact",
			"upTo",
		])
		.optional(),
	stored: z.number().int().nonnegative(),
	available: z.number().int().nonnegative().optional(),
});

type ActivationInputViewSchema = typeof ActivationInputViewSchema;
export namespace ActivationInputViewSchema {
	export type Type = z.infer<ActivationInputViewSchema>;
}

export type ActivationInputView = ActivationInputViewSchema.Type;
