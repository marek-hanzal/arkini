import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { BaseWhenSchema } from "./BaseWhenSchema";
import { WhenEnumSchema } from "./WhenEnumSchema";

/**
 * A condition that checks whether an item query returns one exact quantity.
 */
export const WhenCountSchema = z
	.object({
		...BaseWhenSchema.shape,
		/**
		 * Identifies this condition as an exact item-query quantity check.
		 */
		type: WhenEnumSchema.extract([
			"count",
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
		id: "WhenCountSchema",
		description: "A condition that checks an item query against one exact quantity.",
	});

export type WhenCountSchema = typeof WhenCountSchema;

export namespace WhenCountSchema {
	export type Type = z.infer<WhenCountSchema>;
}
