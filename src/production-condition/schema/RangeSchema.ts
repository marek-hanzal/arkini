import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * A condition that checks whether an item query returns a quantity within an
 * inclusive range.
 */
export const RangeSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this condition as an inclusive item-query quantity range check.
		 */
		type: TypeSchema.extract([
			"Range",
		]).describe("Identifies this condition as an inclusive item-query quantity range check."),
		/**
		 * Smallest item quantity accepted by this condition.
		 */
		min: NonNegativeIntegerSchema.describe(
			"The smallest item quantity accepted by this condition.",
		),
		/**
		 * Largest item quantity accepted by this condition.
		 */
		max: NonNegativeIntegerSchema.describe(
			"The largest item quantity accepted by this condition.",
		),
	})
	.strict()
	.refine((value) => value.max >= value.min, {
		message: "max must be greater than or equal to min",
	})
	.meta({
		id: "when.RangeSchema",
		description: "A condition that checks an item query against an inclusive quantity range.",
	});

export type RangeSchema = typeof RangeSchema;

export namespace RangeSchema {
	export type Type = z.infer<RangeSchema>;
}
