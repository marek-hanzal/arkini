import { z } from "zod";

/**
 * Discriminates the rule used to determine whether an output roll is provided.
 */
export const RollEnumSchema = z
	.enum([
		/**
		 * The output is always provided when the roll's own rules allow it.
		 */
		"guaranteed",
		/**
		 * The output is provided with a probability from 0 to 1.
		 */
		"chance",
		/**
		 * The output is selected from items according to their relative weights.
		 */
		"weight",
	])
	.describe("The rule used to determine an output roll.");

export type RollEnumSchema = typeof RollEnumSchema;

export namespace RollEnumSchema {
	export type Type = z.infer<RollEnumSchema>;
}
