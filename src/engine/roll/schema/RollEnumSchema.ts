import { z } from "zod";

/**
 * Discriminates the rule used to determine whether an output roll is provided.
 */
export const RollEnumSchema = z
	.enum({
		Guaranteed: "guaranteed",
		Chance: "chance",
		Weight: "weight",
	})
	.meta({
		id: "RollEnumSchema",
		description: "The rule used to determine an output roll.",
	});

export type RollEnumSchema = typeof RollEnumSchema;

export namespace RollEnumSchema {
	export type Type = z.infer<RollEnumSchema>;
}
