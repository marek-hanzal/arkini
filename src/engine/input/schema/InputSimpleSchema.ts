import { z } from "zod";

import { BaseInputSchema } from "./BaseInputSchema";
import { InputEnumSchema } from "./InputEnumSchema";

/**
 * An explicit product-line input with no consumable resource requirement.
 *
 * This marker keeps a line's input contract explicit without inventing a
 * material, quantity, reservation, or deposit-capacity operation.
 */
export const InputSimpleSchema = z
	.object({
		...BaseInputSchema.shape,
		/**
		 * Identifies this input as having no consumable resource requirement.
		 */
		type: InputEnumSchema.extract([
			InputEnumSchema.enum.Simple,
		]).describe("Identifies this input as having no consumable resource requirement."),
	})
	.strict()
	.meta({
		id: "InputSimpleSchema",
		description: "An explicit product-line input with no consumable resource requirement.",
	});

export type InputSimpleSchema = typeof InputSimpleSchema;

export namespace InputSimpleSchema {
	export type Type = z.infer<InputSimpleSchema>;
}
