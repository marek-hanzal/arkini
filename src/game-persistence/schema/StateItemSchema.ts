import { z } from "zod";
import { ScheduleStateSchema } from "~/item-schedule/schema/ScheduleStateSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { LocationSchema } from "~/item-location/schema/LocationSchema";

/**
 * A persisted live item that owns its current location.
 */
export const StateItemSchema = z
	.object({
		schedule: ScheduleStateSchema.optional(),
		mergeSequence: NonNegativeIntegerSchema.optional().describe(
			"Successful merges owned by this surviving identity; omitted means zero.",
		),
		/**
		 * Stable identity of this live item.
		 */
		id: IdSchema.describe("The stable identity of this live item."),
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
	})
	.strict()
	.meta({
		id: "StateItemSchema",
		description: "A persisted live item that owns its current location.",
	});

export type StateItemSchema = typeof StateItemSchema;

export namespace StateItemSchema {
	export type Type = z.infer<StateItemSchema>;
}
