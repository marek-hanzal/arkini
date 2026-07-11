import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";

/**
 * One zero-based position in a two-dimensional game grid.
 */
export const PositionSchema = z
	.object({
		/**
		 * Zero-based horizontal grid coordinate.
		 */
		x: NonNegativeIntegerSchema.describe("The zero-based horizontal grid coordinate."),
		/**
		 * Zero-based vertical grid coordinate.
		 */
		y: NonNegativeIntegerSchema.describe("The zero-based vertical grid coordinate."),
	})
	.strict()
	.meta({
		id: "PositionSchema",
		description: "One zero-based position in a two-dimensional game grid.",
	});

export type PositionSchema = typeof PositionSchema;

export namespace PositionSchema {
	export type Type = z.infer<PositionSchema>;
}
