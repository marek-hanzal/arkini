import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GridBoundsSchema } from "~/engine/grid/schema/GridBoundsSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

/**
 * One live item owns coordinates outside its concrete grid.
 */
export const LocationOutOfBoundsIssueSchema = z
	.object({
		itemId: IdSchema.describe("The live item outside its grid bounds."),
		location: GridLocationSchema.describe("The invalid concrete item location."),
		size: GridBoundsSchema.describe("The configured bounds of the targeted grid."),
		type: RuntimeCheckIssueEnumSchema.extract(["LocationOutOfBounds"]),
	})
	.strict()
	.meta({
		id: "LocationOutOfBoundsIssueSchema",
		description: "One live item owns coordinates outside its concrete grid.",
	});

export type LocationOutOfBoundsIssueSchema = typeof LocationOutOfBoundsIssueSchema;

export namespace LocationOutOfBoundsIssueSchema {
	export type Type = z.infer<LocationOutOfBoundsIssueSchema>;
}
