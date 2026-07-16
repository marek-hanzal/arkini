import { z } from "zod";

import { QuerySchema } from "~/engine/query/schema/QuerySchema";

/**
 * Fields shared by every item-query condition.
 *
 * Specialized conditions spread `BaseWhenSchema.shape` and define how the
 * quantity returned by the query is evaluated.
 */
export const BaseWhenSchema = z
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
		id: "BaseWhenSchema",
		description: "The common item query shared by every condition.",
	});

export type BaseWhenSchema = typeof BaseWhenSchema;

export namespace BaseWhenSchema {
	export type Type = z.infer<BaseWhenSchema>;
}
