import { z } from "zod";

import { BaseWhenSchema } from "./BaseWhenSchema";
import { WhenEnumSchema } from "./WhenEnumSchema";

/**
 * A general condition that checks the result count of an item query.
 *
 * Unlike the narrower named condition variants, this schema places no further
 * restriction on the inherited query beyond `QuerySchema` itself.
 */
export const WhenQuerySchema = z
	.object({
		...BaseWhenSchema.shape,
		/**
		 * Identifies this condition as a general item-query count check.
		 */
		type: WhenEnumSchema.extract([
			"query",
		]).describe("Identifies this condition as a general item-query count check."),
	})
	.strict()
	.meta({
		id: "WhenQuerySchema",
		description: "A general condition that checks an item query against a count threshold.",
	});

export type WhenQuerySchema = typeof WhenQuerySchema;

export namespace WhenQuerySchema {
	export type Type = z.infer<WhenQuerySchema>;
}
