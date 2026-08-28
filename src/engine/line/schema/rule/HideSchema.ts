import { z } from "zod";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * A rule that hides a product line.
 *
 * When this rule applies, it takes precedence over the line's `show` default
 * and any applicable `show` rule.
 */
export const HideSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this rule as a request to hide the line.
		 */
		type: TypeSchema.extract([
			"Hide",
		]).describe("Identifies this rule as a request to hide the product line."),
	})
	.strict()
	.meta({
		id: "line.rule.HideSchema",
		description: "A rule that hides a product line when its condition is satisfied.",
	});

export type HideSchema = typeof HideSchema;

export namespace HideSchema {
	export type Type = z.infer<HideSchema>;
}
