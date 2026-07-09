import { z } from "zod";

import { PositiveIntegerSchema } from "./PositiveIntegerSchema";

/**
 * Required number of matches for the rule to pass.
 */
export const MatchCountSchema = z
	.object({
		/**
		 * Minimum number of matches required.
		 */
		min: PositiveIntegerSchema.describe("Minimum number of matches required."),

		/**
		 * Maximum number of matches allowed.
		 */
		max: PositiveIntegerSchema.optional().describe("Maximum number of matches allowed."),
	})
	.strict()
	.refine((value) => value.max === undefined || value.max >= value.min, {
		message: "count.max must be greater than or equal to count.min",
	})
	.describe("How many matching targets are required for the rule to pass.");

export type MatchCountSchema = typeof MatchCountSchema;

export namespace MatchCountSchema {
	export type Type = z.infer<MatchCountSchema>;
}
