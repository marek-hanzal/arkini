import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { TimeSchema } from "~/v1/common/schema/TimeSchema";

/**
 * Dynamic properties of one product line after its rules are evaluated.
 *
 * Inputs and outputs remain owned by the immutable line configuration. This
 * result contains only values that can change with the current runtime state.
 */
export const LineResultSchema = z
	.object({
		/**
		 * Stable ID of the evaluated product line.
		 */
		id: IdSchema.describe("The stable ID of the evaluated product line."),
		/**
		 * Whether the evaluated product line is currently visible.
		 */
		show: z.boolean().describe("Whether the evaluated product line is currently visible."),
		/**
		 * Whether the evaluated product line is currently available to start.
		 */
		enable: z
			.boolean()
			.describe("Whether the evaluated product line is currently available to start."),
		/**
		 * Concrete runtime after every active multiplier has been applied.
		 */
		runtimeMs: TimeSchema.describe(
			"The concrete runtime after every active product-line multiplier has been applied.",
		),
	})
	.strict()
	.meta({
		id: "LineResultSchema",
		description: "The dynamic properties of one product line after rule evaluation.",
	});

export type LineResultSchema = typeof LineResultSchema;

export namespace LineResultSchema {
	export type Type = z.infer<LineResultSchema>;
}
