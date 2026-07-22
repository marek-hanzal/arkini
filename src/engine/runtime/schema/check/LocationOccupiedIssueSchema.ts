import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

/**
 * Multiple live items own one concrete location.
 */
export const LocationOccupiedIssueSchema = z
	.object({
		itemIds: z
			.array(IdSchema)
			.min(2)
			.describe("The live item identities that own the same location."),
		location: GridLocationSchema.describe("The concrete location owned more than once."),
		type: RuntimeCheckIssueEnumSchema.extract([
			RuntimeCheckIssueEnumSchema.enum.LocationOccupied,
		]),
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
