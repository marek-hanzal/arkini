import { z } from "zod";

/**
 * Discriminates the rule used to determine whether an output roll is provided.
 */
export const TypeSchema = z
	.enum({
		Guaranteed: "guaranteed",
		Chance: "chance",
		Weight: "weight",
	})
	.meta({
		id: "roll.TypeSchema",
		description: "The rule used to determine an output roll.",
	});

export type TypeSchema = typeof TypeSchema;

export namespace TypeSchema {
	export type Type = z.infer<TypeSchema>;
}
