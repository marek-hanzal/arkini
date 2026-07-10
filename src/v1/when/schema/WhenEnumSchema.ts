import { z } from "zod";

/**
 * Discriminates the conditions evaluated by a rule.
 */
export const WhenEnumSchema = z
	.enum([
		/**
		 * Checks whether the query returns any matching item quantity.
		 */
		"exists",
		/**
		 * Checks whether the query returns one exact item quantity.
		 */
		"count",
		/**
		 * Checks whether the query result is within an inclusive quantity range.
		 */
		"range",
	])
	.meta({
		id: "WhenEnumSchema",
		description: "The kind of condition evaluated by a rule.",
	});

export type WhenEnumSchema = typeof WhenEnumSchema;

export namespace WhenEnumSchema {
	export type Type = z.infer<WhenEnumSchema>;
}
