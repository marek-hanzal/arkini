import { z } from "zod";

import { BaseWhenSchema } from "./BaseWhenSchema";
import { WhenEnumSchema } from "./WhenEnumSchema";

/**
 * A condition that checks whether an item query returns any quantity.
 */
export const WhenExistsSchema = z
	.object({
		...BaseWhenSchema.shape,
		/**
		 * Identifies this condition as an item-query existence check.
		 */
		type: WhenEnumSchema.extract([
			"Exists",
		]).describe("Identifies this condition as an item-query existence check."),
	})
	.strict()
	.meta({
		id: "WhenExistsSchema",
		description: "A condition that checks whether an item query returns any quantity.",
	});

export type WhenExistsSchema = typeof WhenExistsSchema;

export namespace WhenExistsSchema {
	export type Type = z.infer<WhenExistsSchema>;
}
