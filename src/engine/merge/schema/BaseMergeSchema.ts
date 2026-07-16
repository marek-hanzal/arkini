import { z } from "zod";

import { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";
import { ActionEnumSchema } from "./ActionEnumSchema";

/**
 * Fields shared by every directional merge rule owned by a source item.
 *
 * Specialized schemas spread `BaseMergeSchema.shape` and define the exact
 * outcome for the matched target through their `effect` discriminator.
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
		 * Action applied to the source item after this merge resolves.
		 */
		action: ActionEnumSchema.describe(
			"The action applied to the source item after this merge resolves.",
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
		description:
			"The common source action, target selector, and output fields shared by directional item merges.",
	});

export type BaseMergeSchema = typeof BaseMergeSchema;

export namespace BaseMergeSchema {
	export type Type = z.infer<BaseMergeSchema>;
}
