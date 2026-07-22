import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";

/**
 * One live item occupies a grid forbidden by its canonical item definition.
 */
export const LocationScopeIssueSchema = z
	.object({
		configuredScope: StorageScopeEnumSchema.describe(
			"The storage scope allowed by the canonical item definition.",
		),
		itemId: IdSchema.describe("The live item stored in a forbidden grid."),
		location: GridLocationSchema.describe("The forbidden concrete item location."),
		type: RuntimeCheckIssueEnumSchema.extract([
			RuntimeCheckIssueEnumSchema.enum.LocationScope,
		]),
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
