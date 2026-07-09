import { z } from "zod";

import { OutputSchema } from "~/v1/output/schema/OutputSchema";
import { IdSchema } from "~/v1/common/schema/IdSchema";
import { ActionEnumSchema } from "./ActionEnumSchema";

/**
 * A directional interaction initiated by dropping its owning item onto another item.
 *
 * When `result` is defined, the receiving item becomes that result. When it is
 * omitted, the receiving item is removed instead. Keeping `result` optional
 * represents both outcomes through one directional interaction contract rather
 * than duplicating a near-identical remove schema. `action` then determines
 * whether the source returns to its original position or is consumed. The
 * receiving item does not define a reverse merge implicitly.
 */
export const MergeSchema = z
	.object({
		/**
		 * Optional ID of the item that replaces the receiving item after this merge.
		 *
		 * When omitted, this merge removes the receiving item instead of replacing it.
		 */
		result: IdSchema.optional().describe(
			"The optional ID that replaces the receiving item; omit it to remove that item.",
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
	.meta({
		id: "MergeSchema",
		description: "A directional item merge that transforms or removes the receiving item.",
	});

export type MergeSchema = typeof MergeSchema;

export namespace MergeSchema {
	export type Type = z.infer<MergeSchema>;
}
