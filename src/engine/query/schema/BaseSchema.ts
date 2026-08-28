import { z } from "zod";

import { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

/**
 * Fields shared by every runtime item query.
 *
 * Specialized query schemas spread `BaseSchema.shape` and define where
 * matching items are searched through their `scope` discriminator.
 */
export const BaseSchema = z
	.object({
		/**
		 * Canonical item used to select query candidates.
		 */
		selector: SelectorSchema.describe("The canonical item used to select query candidates."),
	})
	.strict()
	.meta({
		id: "query.BaseSchema",
		description: "The common item selector shared by every runtime item query.",
	});

export type BaseSchema = typeof BaseSchema;

export namespace BaseSchema {
	export type Type = z.infer<BaseSchema>;
}
