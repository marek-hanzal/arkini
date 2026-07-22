import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";

import { BaseQuantitySchema } from "./BaseQuantitySchema";
import { QuantityEnumSchema } from "./QuantityEnumSchema";

/**
 * An inclusive range from which a positive item quantity is selected.
 */
export const QuantityRangeSchema = z
	.object({
		...BaseQuantitySchema.shape,
		type: QuantityEnumSchema.extract([
			QuantityEnumSchema.enum.Range,
		]),
		/**
		 * The smallest quantity that can be selected from this range.
		 */
		min: PositiveIntegerSchema.describe("The smallest positive quantity in the range."),
		/**
		 * The largest quantity that can be selected from this range.
		 */
		max: PositiveIntegerSchema.describe("The largest positive quantity in the range."),
	})
	.strict()
	.refine((value) => value.max >= value.min, {
		message: "max must be greater than or equal to min",
	})
	.meta({
		id: "QuantityRangeSchema",
		description: "An inclusive range of positive item quantities.",
	});

export type QuantityRangeSchema = typeof QuantityRangeSchema;

export namespace QuantityRangeSchema {
	export type Type = z.infer<QuantityRangeSchema>;
}
