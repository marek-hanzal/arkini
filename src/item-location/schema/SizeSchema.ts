import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";

/**
 * The two-dimensional size of a game grid.
 *
 * Board and inventory layouts use the same explicit width-by-height contract.
 */
export const SizeSchema = z
	.object({
		/**
		 * Number of grid cells arranged horizontally.
		 */
		width: PositiveIntegerSchema.describe(
			"The positive number of grid cells arranged horizontally.",
		),
		/**
		 * Number of grid cells arranged vertically.
		 */
		height: PositiveIntegerSchema.describe(
			"The positive number of grid cells arranged vertically.",
		),
	})
	.strict()
	.meta({
		id: "grid.SizeSchema",
		description: "The explicit width and height of a two-dimensional game grid.",
	});

export type SizeSchema = typeof SizeSchema;

export namespace SizeSchema {
	export type Type = z.infer<SizeSchema>;
}
