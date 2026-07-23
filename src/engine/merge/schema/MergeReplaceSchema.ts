import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

import { BaseMergeSchema } from "./BaseMergeSchema";
import { EffectEnumSchema } from "./EffectEnumSchema";

/**
 * A merge that replaces its matched receiving item with an explicit result.
 */
export const MergeReplaceSchema = z
	.object({
		...BaseMergeSchema.shape,
		/**
		 * Identifies this merge as one that replaces its selected target.
		 */
		effect: EffectEnumSchema.extract([
			"Replace",
		]).describe("Identifies this merge as one that replaces its selected target."),
		/**
		 * Canonical item that replaces the selected target.
		 */
		result: IdSchema.describe("The canonical item that replaces the selected target."),
	})
	.strict()
	.meta({
		id: "MergeReplaceSchema",
		description: "A merge that replaces its selected receiving item with an explicit result.",
	});

export type MergeReplaceSchema = typeof MergeReplaceSchema;

export namespace MergeReplaceSchema {
	export type Type = z.infer<MergeReplaceSchema>;
}
