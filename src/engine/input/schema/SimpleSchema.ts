import { z } from "zod";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * An explicit action requirement with no consumable resource requirement.
 *
 * This marker keeps a line's input contract explicit without inventing a
 * material, quantity, reservation, or deposit-capacity operation.
 */
export const SimpleSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this input as having no consumable resource requirement.
		 */
		type: TypeSchema.extract([
			"Simple",
		]).describe("Identifies this input as having no consumable resource requirement."),
	})
	.strict()
	.meta({
		id: "input.SimpleSchema",
		description: "An explicit action requirement with no consumable resource requirement.",
	});

export type SimpleSchema = typeof SimpleSchema;

export namespace SimpleSchema {
	export type Type = z.infer<SimpleSchema>;
}
