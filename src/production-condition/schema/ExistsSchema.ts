import { z } from "zod";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * A condition that checks whether an item query returns any quantity.
 */
export const ExistsSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this condition as an item-query existence check.
		 */
		type: TypeSchema.extract([
			"Exists",
		]).describe("Identifies this condition as an item-query existence check."),
	})
	.strict()
	.meta({
		id: "when.ExistsSchema",
		description: "A condition that checks whether an item query returns any quantity.",
	});

export type ExistsSchema = typeof ExistsSchema;

export namespace ExistsSchema {
	export type Type = z.infer<ExistsSchema>;
}
