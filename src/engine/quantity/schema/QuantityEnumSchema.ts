import { z } from "zod";

/**
 * Discriminates the way a drop quantity is determined.
 */
export const QuantityEnumSchema = z
	.enum({
		Value: "value",
		Range: "range",
	})
	.meta({
		id: "QuantityEnumSchema",
		description: "The way a drop quantity is determined.",
	});

export type QuantityEnumSchema = typeof QuantityEnumSchema;

export namespace QuantityEnumSchema {
	export type Type = z.infer<QuantityEnumSchema>;
}
