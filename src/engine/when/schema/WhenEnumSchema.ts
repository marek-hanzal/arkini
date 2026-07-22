import { z } from "zod";

/**
 * Discriminates the conditions evaluated by a rule.
 */
export const WhenEnumSchema = z
	.enum({
		Exists: "exists",
		Count: "count",
		Range: "range",
	})
	.meta({
		id: "WhenEnumSchema",
		description: "The kind of condition evaluated by a rule.",
	});

export type WhenEnumSchema = typeof WhenEnumSchema;

export namespace WhenEnumSchema {
	export type Type = z.infer<WhenEnumSchema>;
}
