import { z } from "zod";

import { BaseMergeSchema } from "./BaseMergeSchema";
import { EffectEnumSchema } from "./EffectEnumSchema";

/**
 * A merge that keeps its matched receiving item unchanged.
 *
 * It deliberately has no `result`: its optional output is resolved while the
 * selected target remains the same canonical item.
 */
export const MergeKeepSchema = z
	.object({
		...BaseMergeSchema.shape,
		/**
		 * Identifies this merge as one that leaves its selected target unchanged.
		 */
		effect: EffectEnumSchema.extract([
			"keep",
		]).describe("Identifies this merge as one that keeps its selected target unchanged."),
	})
	.strict()
	.meta({
		id: "MergeKeepSchema",
		description: "A merge that leaves its selected receiving item unchanged.",
	});

export type MergeKeepSchema = typeof MergeKeepSchema;

export namespace MergeKeepSchema {
	export type Type = z.infer<MergeKeepSchema>;
}
