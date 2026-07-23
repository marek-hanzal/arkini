import { z } from "zod";

import { BaseMergeSchema } from "./BaseMergeSchema";
import { EffectEnumSchema } from "./EffectEnumSchema";

/**
 * A merge that removes its matched receiving item.
 *
 * The source item's `action` remains independent, allowing a tool such as an
 * axe to be consumed while the selected tree is removed.
 */
export const MergeRemoveSchema = z
	.object({
		...BaseMergeSchema.shape,
		/**
		 * Identifies this merge as one that removes its selected target.
		 */
		effect: EffectEnumSchema.extract([
			"Remove",
		]).describe("Identifies this merge as one that removes its selected target."),
	})
	.strict()
	.meta({
		id: "MergeRemoveSchema",
		description: "A merge that removes its selected receiving item.",
	});

export type MergeRemoveSchema = typeof MergeRemoveSchema;

export namespace MergeRemoveSchema {
	export type Type = z.infer<MergeRemoveSchema>;
}
