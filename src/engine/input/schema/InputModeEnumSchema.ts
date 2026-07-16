import { z } from "zod";

/**
 * Discriminates how an input item participates in a product line.
 */
export const InputModeEnumSchema = z
	.enum([
		/**
		 * Consumes the input item as part of the product line's work.
		 */
		"consume",
		/**
		 * Temporarily reserves the input item and returns it when the work ends.
		 */
		"reserve",
	])
	.meta({
		id: "InputModeEnumSchema",
		description: "How an input item participates in a product line.",
	});

export type InputModeEnumSchema = typeof InputModeEnumSchema;

export namespace InputModeEnumSchema {
	export type Type = z.infer<InputModeEnumSchema>;
}
