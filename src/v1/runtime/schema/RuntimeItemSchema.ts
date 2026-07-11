import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { ItemSchema } from "~/v1/item/schema/ItemSchema";
import { LocationSchema } from "~/v1/location/schema/LocationSchema";

/**
 * A hydrated live item or item stack that owns its current location.
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
		 * Current concrete location owned by this live item.
		 */
		location: LocationSchema.describe("The current concrete location owned by this item."),
		/**
		 * Number of canonical items represented by this live runtime entry.
		 */
		quantity: PositiveIntegerSchema.describe(
			"The positive quantity represented by this live runtime entry.",
		),
	})
	.strict()
	.meta({
		id: "RuntimeItemSchema",
		description: "A hydrated live item or item stack that owns its current location.",
	});

export type RuntimeItemSchema = typeof RuntimeItemSchema;

export namespace RuntimeItemSchema {
	export type Type = z.infer<RuntimeItemSchema>;
}
