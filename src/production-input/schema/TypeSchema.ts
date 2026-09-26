import { z } from "zod";

/**
 * Discriminates the kind of resource required by a product line.
 */
export const TypeSchema = z
	.enum({
		Materials: "materials",
		Units: "units",
	})
	.meta({
		id: "input.TypeSchema",
		description: "The kind of resource required by a product line.",
	});

export type TypeSchema = typeof TypeSchema;

export namespace TypeSchema {
	export type Type = z.infer<TypeSchema>;
}
