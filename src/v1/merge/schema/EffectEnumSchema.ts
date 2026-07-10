import { z } from "zod";

/**
 * Discriminates what happens to the receiving item matched by a merge rule.
 */
export const EffectEnumSchema = z
	.enum([
		/**
		 * Leaves the matched receiving item unchanged.
		 */
		"keep",
		/**
		 * Removes the matched receiving item.
		 */
		"remove",
		/**
		 * Replaces the matched receiving item with an explicit result item.
		 */
		"replace",
	])
	.meta({
		id: "EffectEnumSchema",
		description: "The effect applied to the receiving item matched by a merge rule.",
	});

export type EffectEnumSchema = typeof EffectEnumSchema;

export namespace EffectEnumSchema {
	export type Type = z.infer<EffectEnumSchema>;
}
