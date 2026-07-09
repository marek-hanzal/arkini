import { z } from "zod";

/**
 * Discriminates the conditions evaluated by a rule.
 */
export const WhenEnumSchema = z
	.enum([
		/**
		 * Checks whether an item exists in a configured game-state scope often enough.
		 */
		"count",
		/**
		 * Checks whether enough matching items exist at a configured board distance.
		 */
		"distance",
	])
	.meta({
		id: "WhenEnumSchema",
		description: "The kind of condition evaluated by a rule.",
	});

export type WhenEnumSchema = typeof WhenEnumSchema;

export namespace WhenEnumSchema {
	export type Type = z.infer<WhenEnumSchema>;
}
