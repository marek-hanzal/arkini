import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";

const GridBoundsSchema = z
	.object({
		width: NonNegativeIntegerSchema.describe(
			"The non-negative number of grid cells arranged horizontally.",
		),
		height: NonNegativeIntegerSchema.describe(
			"The non-negative number of grid cells arranged vertically.",
		),
	})
	.strict()
	.meta({
		id: "GridBoundsSchema",
		description: "The possibly empty width and height of a configured grid surface.",
	});

/**
 * One live item owns coordinates outside its concrete grid.
 */
export const LocationOutOfBoundsIssueSchema = z
	.object({
		itemId: IdSchema.describe("The live item outside its grid bounds."),
		location: GridLocationSchema.describe("The invalid concrete item location."),
		size: GridBoundsSchema.describe("The configured bounds of the targeted grid."),
		type: RuntimeCheckIssueEnumSchema.extract([
			"LocationOutOfBounds",
		]),
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
