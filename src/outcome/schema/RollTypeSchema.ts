import { z } from "zod";

/**
 * Discriminates the rule used to determine whether an outcome roll is provided.
 */
export const RollTypeSchema = z
	.enum({
		Guaranteed: "guaranteed",
		Chance: "chance",
	})
	.meta({
		id: "roll.TypeSchema",
		description: "The rule used to determine an outcome roll.",
	});

export type RollTypeSchema = typeof RollTypeSchema;

export namespace RollTypeSchema {
	export type Type = z.infer<RollTypeSchema>;
}
