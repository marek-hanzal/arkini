import { z } from "zod";

/**
 * Discriminates the conditions evaluated by a rule.
 */
export const TypeSchema = z
	.enum({
		Exists: "exists",
		Count: "count",
		Range: "range",
	})
	.meta({
		id: "when.TypeSchema",
		description: "The kind of condition evaluated by a rule.",
	});

export type TypeSchema = typeof TypeSchema;

export namespace TypeSchema {
	export type Type = z.infer<TypeSchema>;
}
