import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";

/**
 * Fields persisted for every live item or item stack.
 */
export const BaseStateItemSchema = z
	.object({
		/**
		 * Stable identity of this live item or stack.
		 */
		id: IdSchema.describe("The stable identity of this live item or stack."),
		/**
		 * ID of the canonical item definition restored during hydration.
		 */
		itemId: IdSchema.describe(
			"The ID of the canonical item definition restored during hydration.",
		),
		/**
		 * Number of canonical items represented by this live state entry.
		 */
		quantity: PositiveIntegerSchema.describe(
			"The positive quantity represented by this live state entry.",
		),
	})
	.strict()
	.meta({
		id: "BaseStateItemSchema",
		description: "The persisted fields shared by every live item or item stack.",
	});

export type BaseStateItemSchema = typeof BaseStateItemSchema;

export namespace BaseStateItemSchema {
	export type Type = z.infer<BaseStateItemSchema>;
}
