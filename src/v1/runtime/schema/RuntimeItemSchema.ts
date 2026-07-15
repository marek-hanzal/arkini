import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { ItemSchema } from "~/v1/item/schema/ItemSchema";
import { LocationSchema } from "~/v1/location/schema/LocationSchema";
import { RevisionSchema } from "~/v1/revision/schema/RevisionSchema";
import { TimeSchema } from "~/v1/common/schema/TimeSchema";

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
		 * Remaining charges of this concrete item instance after its first use.
		 *
		 * Undefined means the instance still owns its authored full charge amount.
		 */
		remainingCharges: NonNegativeIntegerSchema.optional().describe(
			"The optional remaining charges of this concrete item instance; undefined means the authored full amount.",
		),
		/**
		 * Remaining fixed-step lifetime of one temporary item instance.
		 *
		 * Undefined is canonical for every non-temporary item.
		 */
		remainingDurationMs: TimeSchema.optional().describe(
			"The optional remaining fixed-step lifetime of this temporary item instance.",
		),
		/**
		 * Number of canonical items represented by this live runtime entry.
		 */
		quantity: PositiveIntegerSchema.describe(
			"The positive quantity represented by this live runtime entry.",
		),
		/**
		 * Opaque optimistic-concurrency token replaced after every mutation.
		 */
		revision: RevisionSchema.describe(
			"The optimistic-concurrency revision of this live runtime item.",
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
