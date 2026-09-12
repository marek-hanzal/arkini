import { z } from "zod";

import { BoardSchema } from "~/item-query/schema/BoardSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * A Board item selected to pay an action’s unit cost in place.
 *
 * The target is never delivered into an input buffer. Its unit cost is authored
 * through the shared `units` field and paid atomically when the enclosing action commits.
 */
export const UnitsSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this input as one item on the Board that can pay units.
		 */
		type: TypeSchema.extract([
			"Units",
		]).describe("Identifies this input as one item on the Board that can pay units."),
		/**
		 * Board query used to select one target with units for this input.
		 */
		query: BoardSchema.describe(
			"The board query used to select one target with units for this input.",
		),
	})
	.strict()
	.meta({
		id: "input.UnitsSchema",
		description: "A board query that resolves one Board item that can pay units.",
	});

export type UnitsSchema = typeof UnitsSchema;

export namespace UnitsSchema {
	export type Type = z.infer<UnitsSchema>;
}
