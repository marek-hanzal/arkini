import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { GridSizeSchema } from "~/v1/grid/schema/GridSizeSchema";
import { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";

/**
 * One live item owns coordinates outside its concrete grid.
 */
export const LocationOutOfBoundsIssueSchema = z
	.object({
		itemId: IdSchema.describe("The live item outside its grid bounds."),
		location: GridLocationSchema.describe("The invalid concrete item location."),
		size: GridSizeSchema.describe("The configured size of the targeted grid."),
		type: z.literal("location:out-of-bounds"),
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
