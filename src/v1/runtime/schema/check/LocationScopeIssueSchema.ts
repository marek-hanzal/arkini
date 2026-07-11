import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { LocationSchema } from "~/v1/location/schema/LocationSchema";
import { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";

/**
 * One live item occupies a grid forbidden by its canonical item definition.
 */
export const LocationScopeIssueSchema = z
	.object({
		configuredScope: ScopeEnumSchema.describe(
			"The storage scope allowed by the canonical item definition.",
		),
		itemId: IdSchema.describe("The live item stored in a forbidden grid."),
		location: LocationSchema.describe("The forbidden concrete item location."),
		type: z.literal("location:scope"),
	})
	.strict()
	.meta({
		id: "LocationScopeIssueSchema",
		description: "One live item occupies a grid forbidden by its canonical definition.",
	});

export type LocationScopeIssueSchema = typeof LocationScopeIssueSchema;

export namespace LocationScopeIssueSchema {
	export type Type = z.infer<LocationScopeIssueSchema>;
}
