import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/game-config/schema/NonNegativeIntegerSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * A condition that checks whether an item query returns one exact quantity.
 */
export const CountSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this condition as an exact item-query quantity check.
		 */
		type: TypeSchema.extract([
			"Count",
		]).describe("Identifies this condition as an exact item-query quantity check."),
		/**
		 * Exact item quantity that the query must return.
		 */
		count: NonNegativeIntegerSchema.describe(
			"The exact item quantity that the query must return.",
		),
	})
	.strict()
	.meta({
		id: "when.CountSchema",
		description: "A condition that checks an item query against one exact quantity.",
	});

export type CountSchema = typeof CountSchema;

export namespace CountSchema {
	export type Type = z.infer<CountSchema>;
}
