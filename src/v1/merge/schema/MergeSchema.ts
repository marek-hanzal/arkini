import { z } from "zod";

import { OutputSchema } from "~/v1/output/schema/OutputSchema";
import { IdSchema } from "~/v1/common/schema/IdSchema";
import { ActionEnumSchema } from "./ActionEnumSchema";

/**
 * A directional interaction initiated by dropping its owning item onto another item.
 *
 * The receiving item becomes `result`; `action` then determines whether the
 * source returns to its original position or is consumed. The receiving item
 * does not define a reverse merge implicitly.
 */
export const MergeSchema = z
	.object({
		/**
		 * ID of the item that replaces the receiving item after this merge.
		 */
		result: IdSchema.describe(
			"The ID of the item that replaces the receiving item after this merge.",
		),
		/**
		 * Action applied to the source item after it changes the receiving item.
		 */
		action: ActionEnumSchema.describe(
			"The action applied to the source item after it changes the receiving item.",
		),
		/**
		 * Optional extra output evaluated after the merge's source action completes.
		 */
		output: OutputSchema.optional().describe(
			"The optional extra output evaluated after this merge completes.",
		),
	})
	.strict()
	.describe("A directional item merge that replaces the receiving item with a result.");

export type MergeSchema = typeof MergeSchema;

export namespace MergeSchema {
	export type Type = z.infer<MergeSchema>;
}
