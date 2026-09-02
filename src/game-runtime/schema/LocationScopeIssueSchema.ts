import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { StorageSchema } from "~/item-definition/schema/StorageSchema";

/**
 * One live item occupies a grid forbidden by its canonical item definition.
 */
export const LocationScopeIssueSchema = z
	.object({
		configuredScope: StorageSchema.describe(
			"The storage scope allowed by the canonical item definition.",
		),
		itemId: IdSchema.describe("The live item stored in a forbidden grid."),
		location: GridLocationSchema.describe("The forbidden concrete item location."),
		type: RuntimeCheckIssueEnumSchema.extract([
			"LocationScope",
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
