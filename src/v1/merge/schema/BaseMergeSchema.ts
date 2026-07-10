import { z } from "zod";

import { OutputSchema } from "~/v1/output/schema/OutputSchema";
import { SelectorSchema } from "~/v1/selector/schema/SelectorSchema";

/**
 * Fields shared by every directional merge rule owned by a source item.
 *
 * Specialized schemas spread `BaseMergeSchema.shape` and define the exact
 * consequence through their `action` discriminator.
 */
export const BaseMergeSchema = z
	.object({
		/**
		 * Selector that must match the receiving item for this merge to apply.
		 */
		target: SelectorSchema.describe(
			"The selector that must match the receiving item for this merge to apply.",
		),
		/**
		 * Optional extra output evaluated after this merge resolves.
		 */
		output: OutputSchema.optional().describe(
			"The optional extra output evaluated after this merge resolves.",
		),
	})
	.strict()
	.meta({
		id: "BaseMergeSchema",
		description: "The common target and output fields shared by directional item merges.",
	});

export type BaseMergeSchema = typeof BaseMergeSchema;

export namespace BaseMergeSchema {
	export type Type = z.infer<BaseMergeSchema>;
}
