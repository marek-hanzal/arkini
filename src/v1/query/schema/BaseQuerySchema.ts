import { z } from "zod";

import { SelectorSchema } from "~/v1/selector/schema/SelectorSchema";

/**
 * Fields shared by every runtime item query.
 *
 * Specialized query schemas spread `BaseQuerySchema.shape` and define where
 * matching items are searched through their `scope` discriminator.
 */
export const BaseQuerySchema = z
	.object({
		/**
		 * Item or tag matching strategy used to select query candidates.
		 */
		selector: SelectorSchema.describe(
			"The item or tag matching strategy used to select query candidates.",
		),
	})
	.strict()
	.meta({
		id: "BaseQuerySchema",
		description: "The common item selector shared by every runtime item query.",
	});

export type BaseQuerySchema = typeof BaseQuerySchema;

export namespace BaseQuerySchema {
	export type Type = z.infer<BaseQuerySchema>;
}
