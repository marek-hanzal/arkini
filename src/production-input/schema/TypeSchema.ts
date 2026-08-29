import { z } from "zod";

/**
 * Discriminates the kind of resource required by a product line.
 */
export const TypeSchema = z
	.enum({
		Simple: "simple",
		Materials: "materials",
		Deposit: "deposit",
	})
	.meta({
		id: "input.TypeSchema",
		description: "The kind of resource required by a product line.",
	});

export type TypeSchema = typeof TypeSchema;

export namespace TypeSchema {
	export type Type = z.infer<TypeSchema>;
}
