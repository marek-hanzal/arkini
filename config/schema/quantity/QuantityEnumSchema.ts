import { z } from "zod";

/**
 * Discriminates the way a drop quantity is determined.
 */
export const QuantityEnumSchema = z
	.enum([
		/**
		 * A fixed quantity value emitted by the drop.
		 */
		"value",
		/**
		 * An inclusive range from which the emitted quantity is selected.
		 */
		"range",
	])
	.describe("The way a drop quantity is determined.");

export type QuantityEnumSchema = typeof QuantityEnumSchema;

export namespace QuantityEnumSchema {
	export type Type = z.infer<QuantityEnumSchema>;
}
