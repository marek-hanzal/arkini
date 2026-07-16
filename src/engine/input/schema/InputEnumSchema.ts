import { z } from "zod";

/**
 * Discriminates the kind of resource required by a product line.
 */
export const InputEnumSchema = z
	.enum([
		/**
		 * An explicit input marker with no material consumption or deposit spending.
		 */
		"simple",
		/**
		 * Requires a directly delivered material item that is consumed or reserved.
		 */
		"materials",
		/**
		 * Requires capacity from a matching deposit on the board.
		 */
		"deposit",
	])
	.meta({
		id: "InputEnumSchema",
		description: "The kind of resource required by a product line.",
	});

export type InputEnumSchema = typeof InputEnumSchema;

export namespace InputEnumSchema {
	export type Type = z.infer<InputEnumSchema>;
}
