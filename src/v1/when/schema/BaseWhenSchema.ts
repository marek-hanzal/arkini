import { z } from "zod";

import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { QuerySchema } from "~/v1/query/schema/QuerySchema";

/**
 * Fields shared by every item-query condition.
 *
 * Specialized conditions spread `BaseWhenSchema.shape` and may narrow the
 * accepted query variant while retaining the same positive count threshold.
 */
export const BaseWhenSchema = z
	.object({
		/**
		 * Query used to find the items evaluated by this condition.
		 */
		query: QuerySchema.describe(
			"The query used to find the items evaluated by this condition.",
		),
		/**
		 * Minimum number of matching items required for this condition to pass.
		 */
		count: PositiveIntegerSchema.describe(
			"The minimum number of matching items required for this condition to pass.",
		),
	})
	.strict()
	.meta({
		id: "BaseWhenSchema",
		description: "The common item query and count threshold shared by conditions.",
	});

export type BaseWhenSchema = typeof BaseWhenSchema;

export namespace BaseWhenSchema {
	export type Type = z.infer<BaseWhenSchema>;
}
