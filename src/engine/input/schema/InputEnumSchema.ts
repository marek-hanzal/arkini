import { z } from "zod";

/**
 * Discriminates the kind of resource required by a product line.
 */
export const InputEnumSchema = z
	.enum({
		Simple: "simple",
		Materials: "materials",
		Deposit: "deposit",
	})
	.meta({
		id: "InputEnumSchema",
		description: "The kind of resource required by a product line.",
	});

export type InputEnumSchema = typeof InputEnumSchema;

export namespace InputEnumSchema {
	export type Type = z.infer<InputEnumSchema>;
}
