import { z } from "zod";
import { ScheduleStateSchema } from "~/item-schedule/schema/ScheduleStateSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { LocationSchema } from "~/item-location/schema/LocationSchema";

/**
 * A persisted live item or item stack that owns its current location.
 */
export const StateItemSchema = z
	.object({
		schedule: ScheduleStateSchema.optional(),
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
		 * Remaining units of this concrete item instance after its first use.
		 *
		 * Undefined means the instance still owns its authored full unit amount.
		 */
		remainingUnits: NonNegativeIntegerSchema.optional().describe(
			"The optional remaining units of this concrete item instance; undefined means the authored full amount.",
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
