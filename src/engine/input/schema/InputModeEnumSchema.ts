import { z } from "zod";

/**
 * Discriminates how an input item participates in a product line.
 */
export const InputModeEnumSchema = z
	.enum({
		Consume: "consume",
		Reserve: "reserve",
	})
	.meta({
		id: "InputModeEnumSchema",
		description: "How an input item participates in a product line.",
	});

export type InputModeEnumSchema = typeof InputModeEnumSchema;

export namespace InputModeEnumSchema {
	export type Type = z.infer<InputModeEnumSchema>;
}
