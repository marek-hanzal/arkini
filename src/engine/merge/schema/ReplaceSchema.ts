import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

import { BaseSchema } from "./BaseSchema";
import { TargetEffectSchema } from "./TargetEffectSchema";

/**
 * A merge that replaces its matched receiving item with an explicit result.
 */
export const ReplaceSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this merge as one that replaces its selected target.
		 */
		effect: TargetEffectSchema.extract([
			"Replace",
		]).describe("Identifies this merge as one that replaces its selected target."),
		/**
		 * Canonical item that replaces the selected target.
		 */
		result: IdSchema.describe("The canonical item that replaces the selected target."),
	})
	.strict()
	.meta({
		id: "merge.ReplaceSchema",
		description: "A merge that replaces its selected receiving item with an explicit result.",
	});

export type ReplaceSchema = typeof ReplaceSchema;

export namespace ReplaceSchema {
	export type Type = z.infer<ReplaceSchema>;
}
