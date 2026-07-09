import { z } from "zod";

/**
 * Discriminates the strategy used to select game items.
 */
export const SelectorEnumSchema = z
	.enum([
		/**
		 * Selects one specific item by its stable item ID.
		 */
		"item",
		/**
		 * Selects every item classified with one semantic tag.
		 */
		"tag",
	])
	.describe("The strategy used to select game items.");

export type SelectorEnumSchema = typeof SelectorEnumSchema;

export namespace SelectorEnumSchema {
	export type Type = z.infer<SelectorEnumSchema>;
}
