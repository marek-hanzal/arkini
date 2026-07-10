import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { ActionEnumSchema } from "./ActionEnumSchema";
import { BaseMergeSchema } from "./BaseMergeSchema";

/**
 * A merge that uses its source item and optionally replaces its selected target.
 *
 * When `result` is omitted, the selected target is removed. A defined result
 * replaces it, while the source returns to its original position.
 */
export const MergeUseSchema = z
	.object({
		...BaseMergeSchema.shape,
		/**
		 * Identifies this merge as one that uses and returns its source item.
		 */
		action: ActionEnumSchema.extract([
			"use",
		]).describe("Identifies this merge as one that uses and returns its source item."),
		/**
		 * Optional item that replaces the selected target.
		 */
		result: IdSchema.optional().describe(
			"The optional item that replaces the selected target; omit it to remove that target.",
		),
	})
	.strict()
	.meta({
		id: "MergeUseSchema",
		description:
			"A merge that returns its source item and optionally replaces its selected target.",
	});

export type MergeUseSchema = typeof MergeUseSchema;

export namespace MergeUseSchema {
	export type Type = z.infer<MergeUseSchema>;
}
