import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import { ItemSchema } from "~/v1/item/schema/ItemSchema";
import { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";

/**
 * A hydrated live item or item stack stored in a runtime grid cell.
 */
export const RuntimeItemSchema = z
	.object({
		...PositionSchema.shape,
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
		 * Runtime grid currently containing this item.
		 */
		scope: ScopeEnumSchema.extract([
			"board",
			"inventory",
		]).describe("The runtime grid currently containing this item."),
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
