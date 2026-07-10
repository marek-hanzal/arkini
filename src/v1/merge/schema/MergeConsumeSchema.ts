import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { ActionEnumSchema } from "./ActionEnumSchema";
import { BaseMergeSchema } from "./BaseMergeSchema";

/**
 * A merge that consumes its source item and replaces its selected target.
 *
 * `result` is required so consuming a source always has an explicit resulting
 * item for the matched target.
 */
export const MergeConsumeSchema = z
	.object({
		...BaseMergeSchema.shape,
		/**
		 * Identifies this merge as one that consumes its source item.
		 */
		action: ActionEnumSchema.extract([
			"consume",
		]).describe("Identifies this merge as one that consumes its source item."),
		/**
		 * Item that replaces the selected target.
		 */
		result: IdSchema.describe("The item that replaces the selected target."),
	})
	.strict()
	.meta({
		id: "MergeConsumeSchema",
		description: "A merge that consumes its source item and replaces its selected target.",
	});

export type MergeConsumeSchema = typeof MergeConsumeSchema;

export namespace MergeConsumeSchema {
	export type Type = z.infer<MergeConsumeSchema>;
}
