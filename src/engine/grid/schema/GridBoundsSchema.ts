import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";

/** The possibly empty bounds of one configured grid surface. */
export const GridBoundsSchema = z
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

export type GridBoundsSchema = typeof GridBoundsSchema;

export namespace GridBoundsSchema {
	export type Type = z.infer<GridBoundsSchema>;
}
