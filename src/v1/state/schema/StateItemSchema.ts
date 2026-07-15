import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { TimeSchema } from "~/v1/common/schema/TimeSchema";
import { LocationSchema } from "~/v1/location/schema/LocationSchema";

/**
 * A persisted live item or item stack that owns its current location.
 */
export const StateItemSchema = z
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
		 * Current concrete location owned by this persisted item.
		 */
		location: LocationSchema.describe(
			"The current concrete location owned by this persisted item.",
		),
		/**
		 * Remaining charges of this concrete item instance after its first use.
		 *
		 * Undefined means the instance still owns its authored full charge amount.
		 */
		remainingCharges: NonNegativeIntegerSchema.optional().describe(
			"The optional remaining charges of this concrete item instance; undefined means the authored full amount.",
		),
		/**
		 * Remaining fixed-step lifetime of one persisted temporary item instance.
		 */
		remainingDurationMs: TimeSchema.optional().describe(
			"The optional remaining fixed-step lifetime of this persisted temporary item instance.",
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
		id: "StateItemSchema",
		description: "A persisted live item or item stack that owns its current location.",
	});

export type StateItemSchema = typeof StateItemSchema;

export namespace StateItemSchema {
	export type Type = z.infer<StateItemSchema>;
}
