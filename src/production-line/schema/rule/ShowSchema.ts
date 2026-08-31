import { z } from "zod";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * A rule that makes an otherwise hidden product line visible.
 */
export const ShowSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this rule as a conditional request to show the line.
		 */
		type: TypeSchema.extract([
			"Show",
		]).describe("Identifies this rule as a request to show the product line."),
	})
	.strict()
	.meta({
		id: "line.rule.ShowSchema",
		description: "A rule that conditionally makes a product line visible.",
	});

export type ShowSchema = typeof ShowSchema;

export namespace ShowSchema {
	export type Type = z.infer<ShowSchema>;
}
