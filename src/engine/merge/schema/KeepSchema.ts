import { z } from "zod";

import { BaseSchema } from "./BaseSchema";
import { TargetEffectSchema } from "./TargetEffectSchema";

/**
 * A merge that keeps its matched receiving item unchanged.
 *
 * It deliberately has no `result`: its optional output is resolved while the
 * selected target remains the same canonical item.
 */
export const KeepSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this merge as one that leaves its selected target unchanged.
		 */
		effect: TargetEffectSchema.extract([
			"Keep",
		]).describe("Identifies this merge as one that keeps its selected target unchanged."),
	})
	.strict()
	.meta({
		id: "merge.KeepSchema",
		description: "A merge that leaves its selected receiving item unchanged.",
	});

export type KeepSchema = typeof KeepSchema;

export namespace KeepSchema {
	export type Type = z.infer<KeepSchema>;
}
