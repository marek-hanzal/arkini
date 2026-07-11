import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { LocationSchema } from "~/v1/location/schema/LocationSchema";

/**
 * Multiple live items own one concrete location.
 */
export const LocationOccupiedIssueSchema = z
	.object({
		itemIds: z
			.array(IdSchema)
			.min(2)
			.describe("The live item identities that own the same location."),
		location: LocationSchema.describe("The concrete location owned more than once."),
		type: z.literal("location:occupied"),
	})
	.strict()
	.meta({
		id: "LocationOccupiedIssueSchema",
		description: "Multiple live items own one concrete location.",
	});

export type LocationOccupiedIssueSchema = typeof LocationOccupiedIssueSchema;

export namespace LocationOccupiedIssueSchema {
	export type Type = z.infer<LocationOccupiedIssueSchema>;
}
