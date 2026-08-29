import { z } from "zod";

/**
 * Discriminates what happens to the receiving item matched by a merge rule.
 */
export const TargetEffectSchema = z
	.enum({
		Keep: "keep",
		Remove: "remove",
		Replace: "replace",
	})
	.meta({
		id: "merge.TargetEffectSchema",
		description: "The effect applied to the receiving item matched by a merge rule.",
	});

export type TargetEffectSchema = typeof TargetEffectSchema;

export namespace TargetEffectSchema {
	export type Type = z.infer<TargetEffectSchema>;
}
