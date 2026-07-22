import { z } from "zod";

/**
 * Discriminates what happens to the receiving item matched by a merge rule.
 */
export const EffectEnumSchema = z
	.enum({
		Keep: "keep",
		Remove: "remove",
		Replace: "replace",
	})
	.meta({
		id: "EffectEnumSchema",
		description: "The effect applied to the receiving item matched by a merge rule.",
	});

export type EffectEnumSchema = typeof EffectEnumSchema;

export namespace EffectEnumSchema {
	export type Type = z.infer<EffectEnumSchema>;
}
