import { z } from "zod";

import { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";
import { SourceActionSchema } from "./SourceActionSchema";

/**
 * Fields shared by every directional merge rule owned by a source item.
 *
 * Specialized schemas spread `BaseSchema.shape` and define the exact
 * outcome for the matched target through their `effect` discriminator.
 */
export const BaseSchema = z
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
		action: SourceActionSchema.describe(
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
		id: "merge.BaseSchema",
		description:
			"The common source action, target selector, and output fields shared by directional item merges.",
	});

export type BaseSchema = typeof BaseSchema;

export namespace BaseSchema {
	export type Type = z.infer<BaseSchema>;
}
