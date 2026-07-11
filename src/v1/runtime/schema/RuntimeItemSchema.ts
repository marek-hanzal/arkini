import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { ItemSchema } from "~/v1/item/schema/ItemSchema";

/**
 * A hydrated live item or item stack stored in a runtime grid cell.
 */
export const RuntimeItemSchema = z
	.object({
		/**
		 * Stable identity of this live item or stack.
		 */
		id: IdSchema.describe("The stable identity of this live item or stack."),
		/**
		 * Canonical immutable item definition shared with the loaded game.
		 */
		item: ItemSchema.describe(
			"The canonical immutable item definition shared with the loaded game.",
		),
		/**
		 * Number of canonical items represented by this live runtime entry.
		 */
		quantity: PositiveIntegerSchema.describe(
			"The positive quantity represented by this live runtime entry.",
		),
		/**
		 * Zero-based horizontal coordinate of this item in its runtime grid.
		 */
		x: NonNegativeIntegerSchema.describe(
			"The zero-based horizontal coordinate of this item in its runtime grid.",
		),
		/**
		 * Zero-based vertical coordinate of this item in its runtime grid.
		 */
		y: NonNegativeIntegerSchema.describe(
			"The zero-based vertical coordinate of this item in its runtime grid.",
		),
	})
	.strict()
	.meta({
		id: "RuntimeItemSchema",
		description: "A hydrated live item or item stack stored in a runtime grid cell.",
	});

export type RuntimeItemSchema = typeof RuntimeItemSchema;

export namespace RuntimeItemSchema {
	export type Type = z.infer<RuntimeItemSchema>;
}
