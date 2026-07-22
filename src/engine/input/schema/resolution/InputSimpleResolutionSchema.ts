import { z } from "zod";

import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";

/**
 * Readiness of one simple input that requires no material operation.
 */
export const InputSimpleResolutionSchema = z
	.object({
		/**
		 * Identifies this resolution as one simple input.
		 */
		type: InputEnumSchema.extract([
			InputEnumSchema.enum.Simple,
		]),
		/**
		 * Simple inputs own no material operation but may still require an authored charge payment.
		 */
		ready: z
			.boolean()
			.describe("Whether this simple input and its optional charge cost are ready."),
	})
	.strict()
	.meta({
		id: "InputSimpleResolutionSchema",
		description: "The readiness of one simple input with no material operation.",
	});

export type InputSimpleResolutionSchema = typeof InputSimpleResolutionSchema;

export namespace InputSimpleResolutionSchema {
	export type Type = z.infer<InputSimpleResolutionSchema>;
}
