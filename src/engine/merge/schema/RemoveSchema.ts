import { z } from "zod";

import { BaseSchema } from "./BaseSchema";
import { TargetEffectSchema } from "./TargetEffectSchema";

/**
 * A merge that removes its matched receiving item.
 *
 * The source item's `action` remains independent, allowing a tool such as an
 * axe to be consumed while the selected tree is removed.
 */
export const RemoveSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this merge as one that removes its selected target.
		 */
		effect: TargetEffectSchema.extract([
			"Remove",
		]).describe("Identifies this merge as one that removes its selected target."),
	})
	.strict()
	.meta({
		id: "merge.RemoveSchema",
		description: "A merge that removes its selected receiving item.",
	});

export type RemoveSchema = typeof RemoveSchema;

export namespace RemoveSchema {
	export type Type = z.infer<RemoveSchema>;
}
