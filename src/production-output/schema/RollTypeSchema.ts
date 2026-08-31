import { z } from "zod";

/**
 * Discriminates the rule used to determine whether an output roll is provided.
 */
export const RollTypeSchema = z
	.enum({
		Guaranteed: "guaranteed",
		Chance: "chance",
		Weight: "weight",
	})
	.meta({
		id: "roll.TypeSchema",
		description: "The rule used to determine an output roll.",
	});

export type RollTypeSchema = typeof RollTypeSchema;

export namespace RollTypeSchema {
	export type Type = z.infer<RollTypeSchema>;
}
