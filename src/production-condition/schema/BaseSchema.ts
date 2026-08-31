import { z } from "zod";

import { QuerySchema } from "~/item-query/schema/QuerySchema";

/**
 * Fields shared by every item-query condition.
 *
 * Specialized conditions spread `BaseSchema.shape` and define how the
 * quantity returned by the query is evaluated.
 */
export const BaseSchema = z
	.object({
		/**
		 * Query used to find the items evaluated by this condition.
		 */
		query: QuerySchema.describe(
			"The query used to find the items evaluated by this condition.",
		),
	})
	.strict()
	.meta({
		id: "when.BaseSchema",
		description: "The common item query shared by every condition.",
	});

export type BaseSchema = typeof BaseSchema;

export namespace BaseSchema {
	export type Type = z.infer<BaseSchema>;
}
