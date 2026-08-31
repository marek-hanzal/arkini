import { z } from "zod";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * A rule that adjusts a product line's runtime by a signed millisecond value.
 *
 * Every applicable runtime adjustment stacks additively after the line's
 * active runtime multipliers have been applied.
 */
export const RuntimeAdjustmentSchema = z
	.object({
		...BaseSchema.shape,
		type: TypeSchema.extract([
			"RuntimeAdjust",
		]).describe("Identifies this rule as a product-line runtime adjustment."),
		adjustMs: z
			.number()
			.int()
			.describe("The signed millisecond adjustment added to this product line's runtime."),
	})
	.strict()
	.meta({
		id: "line.rule.RuntimeAdjustmentSchema",
		description: "A rule that adjusts a product line's runtime by a signed millisecond value.",
	});

export type RuntimeAdjustmentSchema = typeof RuntimeAdjustmentSchema;

export namespace RuntimeAdjustmentSchema {
	export type Type = z.infer<RuntimeAdjustmentSchema>;
}
