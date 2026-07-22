import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";

import { BaseWhenSchema } from "./BaseWhenSchema";
import { WhenEnumSchema } from "./WhenEnumSchema";

/**
 * A condition that checks whether an item query returns a quantity within an
 * inclusive range.
 */
export const WhenRangeSchema = z
	.object({
		...BaseWhenSchema.shape,
		/**
		 * Identifies this condition as an inclusive item-query quantity range check.
		 */
		type: WhenEnumSchema.extract([
			WhenEnumSchema.enum.Range,
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
		id: "WhenRangeSchema",
		description: "A condition that checks an item query against an inclusive quantity range.",
	});

export type WhenRangeSchema = typeof WhenRangeSchema;

export namespace WhenRangeSchema {
	export type Type = z.infer<WhenRangeSchema>;
}
